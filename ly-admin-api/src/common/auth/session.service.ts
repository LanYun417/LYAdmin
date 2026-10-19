/**
 * 在线会话服务（Redis 支撑）。
 * 模块职责：记录「一次登录 = 一条会话」，供在线用户列表展示与强制下线使用。
 *
 * 为什么按会话（sid）而不是按令牌（jti）：
 * - accessToken 每 2h 刷新一次、jti 每次都变，按 jti 记录会让"在线用户"一刷新就翻倍；
 * - 会话 id 在登录时生成、access 与 refresh **共用同一个值**，刷新不改变会话身份；
 * - 强制下线 = 删掉会话记录，携带该 sid 的令牌随即被鉴权守卫判定失效
 *   （守卫只在 Redis 可用时才校验会话存在性，Redis 挂了不会把所有人挡在门外）。
 *
 * 数据结构（全部为普通字符串键，避免引入 hash 类型的额外封装）：
 * - `auth:session:<sid>`      ：会话详情 JSON，TTL = refresh 有效期；
 * - `auth:session:user:<uid>` ：该用户的 sid 集合（用于「下线某人的全部会话」）；
 * - `auth:session:index`      ：全局 sid 集合（用于在线用户列表，避免 KEYS/SCAN 全库扫）。
 *
 * 降级：Redis 未配置或异常时所有方法静默返回空/失败，登录流程照常（此时令牌不带 sid，
 * 不参与会话管理），绝不因为会话登记失败而拒绝登录。
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { config } from '../config/config.js';
import { RedisService } from '../redis/redis.service.js';

/** 会话详情（redis 中存的 JSON）。 */
export interface SessionRecord {
  /** 会话 id */
  sid: string;
  userId: number;
  username: string;
  /** 登录时脱下昵称，便于在线列表直接展示（会话期间不随资料变更刷新） */
  nickname: string;
  /** 登录 IP */
  ip: string;
  /** IP 归属地（解析失败为空串） */
  location: string;
  /** 原始 User-Agent（展示时前端自行裁剪） */
  userAgent: string;
  /** 登录时间（毫秒时间戳） */
  loginAt: number;
  /** 最后一次「令牌刷新」时间（毫秒），近似"活跃时间" */
  lastSeenAt: number;
}

/** 会话详情键前缀。 */
const SESSION_KEY_PREFIX = 'auth:session:';
/** 用户会话索引键前缀。 */
const USER_INDEX_PREFIX = 'auth:session:user:';
/** 全局会话索引键。 */
const GLOBAL_INDEX_KEY = 'auth:session:index';

/**
 * 会话 TTL：跟随 refresh 有效期（7 天）+ 1 天余量。
 * 会话比令牌活得久一点，避免"令牌还有效但会话已过期"导致鉴权失败。
 */
function sessionTtlMs(): number {
  return parseExpiresToMs(config.jwt.refreshExpiresIn) + 24 * 60 * 60 * 1000;
}

/** 把 `7d` / `2h` / `30m` 这类有效期文本转成毫秒（无法解析时按 7 天兜底）。 */
function parseExpiresToMs(text: string): number {
  const matched = /^(\d+)\s*([smhd])$/i.exec(text.trim());
  if (!matched) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(matched[1]);
  const unit = (matched[2] ?? 'd').toLowerCase();
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * factor;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * 登记一次登录会话。
   * @param input 会话信息（不含 sid，由本方法生成）
   * @returns 会话 id；Redis 不可用时返回 null（调用方应签发**不带 sid** 的令牌）
   */
  async create(input: Omit<SessionRecord, 'sid' | 'loginAt' | 'lastSeenAt'>): Promise<string | null> {
    const sid = randomUUID();
    const now = Date.now();
    const record: SessionRecord = { ...input, sid, loginAt: now, lastSeenAt: now };
    const ttlMs = sessionTtlMs();

    const stored = await this.redis.set(`${SESSION_KEY_PREFIX}${sid}`, JSON.stringify(record), ttlMs);
    if (!stored) {
      return null;
    }
    // 索引：用户维度 + 全局。两者过期时间与会话一致，避免索引键永久堆积
    await this.redis.sAdd(`${USER_INDEX_PREFIX}${input.userId}`, sid);
    await this.redis.expire(`${USER_INDEX_PREFIX}${input.userId}`, ttlMs);
    await this.redis.sAdd(GLOBAL_INDEX_KEY, sid);
    await this.redis.expire(GLOBAL_INDEX_KEY, ttlMs);
    return sid;
  }

  /**
   * 会话是否仍然有效（鉴权守卫使用）。
   *
   * ⚠️ 只应在 Redis 可用时调用：Redis 不可用时本方法返回 false，
   * 而调用方必须用 `redis.isReady()` 先行判定，否则会造成"Redis 挂了所有人被登出"。
   */
  async isAlive(sid: string): Promise<boolean> {
    return (await this.read(sid)) !== null;
  }

  /** 读取会话详情（不存在返回 null）。 */
  async read(sid: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(`${SESSION_KEY_PREFIX}${sid}`);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SessionRecord;
    } catch {
      return null;
    }
  }

  /** 刷新会话活跃时间（令牌刷新时调用）。 */
  async touch(sid: string): Promise<void> {
    const record = await this.read(sid);
    if (!record) {
      return;
    }
    record.lastSeenAt = Date.now();
    await this.redis.set(`${SESSION_KEY_PREFIX}${sid}`, JSON.stringify(record), sessionTtlMs());
  }

  /** 删除会话（登出 / 强制下线）。 */
  async remove(sid: string, userId?: number): Promise<void> {
    const record = userId === undefined ? await this.read(sid) : null;
    await this.redis.del(`${SESSION_KEY_PREFIX}${sid}`);
    const owner = userId ?? record?.userId;
    if (owner !== undefined && owner !== null) {
      await this.redis.sRem(`${USER_INDEX_PREFIX}${owner}`, sid);
    }
    await this.redis.sRem(GLOBAL_INDEX_KEY, sid);
  }

  /** 删除某用户的全部会话（强制下线某人全部登录）。 */
  async removeAllOfUser(userId: number): Promise<number> {
    const sids = await this.listSidsOfUser(userId);
    if (sids.length === 0) {
      return 0;
    }
    await this.redis.delMany(sids.map((sid) => `${SESSION_KEY_PREFIX}${sid}`));
    await this.redis.del(`${USER_INDEX_PREFIX}${userId}`);
    for (const sid of sids) {
      await this.redis.sRem(GLOBAL_INDEX_KEY, sid);
    }
    return sids.length;
  }

  /** 某用户的会话 id 列表。 */
  async listSidsOfUser(userId: number): Promise<string[]> {
    return this.redis.sMembers(`${USER_INDEX_PREFIX}${userId}`);
  }

  /** 全部会话 id（带上限，防止历史脏索引导致一次性拉取过多）。 */
  async listAllSids(limit = 2000): Promise<string[]> {
    const sids = await this.redis.sMembers(GLOBAL_INDEX_KEY);
    return sids.slice(0, limit);
  }

  /**
   * 列出在线会话（已顺带清理索引中失效的 sid）。
   * @param filter 可选过滤条件（账号包含匹配、IP 精确匹配）
   * @returns 会话数组，按最后活跃时间倒序
   */
  async list(filter: { username?: string; ip?: string } = {}): Promise<SessionRecord[]> {
    const sids = await this.listAllSids();
    if (sids.length === 0) {
      return [];
    }
    const records: SessionRecord[] = [];
    const stale: string[] = [];
    for (const sid of sids) {
      const record = await this.read(sid);
      if (!record) {
        // 会话已过期但索引还在：顺手摘掉，避免索引越积越大
        stale.push(sid);
        continue;
      }
      if (filter.username && !record.username.includes(filter.username)) {
        continue;
      }
      if (filter.ip && record.ip !== filter.ip) {
        continue;
      }
      records.push(record);
    }
    if (stale.length > 0) {
      for (const sid of stale) {
        await this.redis.sRem(GLOBAL_INDEX_KEY, sid);
      }
      this.logger.debug(`[Session] 清理失效会话索引 ${stale.length} 条`);
    }
    return records.sort((left, right) => right.lastSeenAt - left.lastSeenAt);
  }

  /** 在线会话数（供仪表盘或列表头部展示）。 */
  async count(): Promise<number> {
    return (await this.list()).length;
  }
}
