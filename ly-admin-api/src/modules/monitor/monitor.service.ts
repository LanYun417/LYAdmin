/**
 * 在线会话服务。
 * 模块职责：把 `SessionService` 的会话记录整理成在线用户列表（分页 + UA 解析），
 * 并提供强制下线（单会话 / 某用户全部会话）能力。
 *
 * 为什么强制下线是「删会话记录」而不是维护黑名单：
 * 令牌携带的 sid 与 Redis 中的会话记录一一对应，记录没了，鉴权守卫（与刷新接口）
 * 就会判定该 sid 已失效——不需要给每个令牌单独记黑名单，也不会随刷新累积垃圾键。
 * 对「不带 sid 的旧令牌」（本次改动前签发的），用户级强制下线会退回用既有的
 * 用户级登出时间戳（`TokenBlacklistService`），保证这类令牌也能被踢掉。
 */
import { Injectable, Logger } from '@nestjs/common';
import { parseUserAgent } from '../../common/utils/user-agent.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import { SessionService, type SessionRecord } from '../../common/auth/session.service.js';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import type { PageResult } from '../../common/types.js';

/** 在线会话对外结构。 */
export interface OnlineSessionItem {
  /** 会话 id（强制下线的入参） */
  sid: string;
  userId: number;
  username: string;
  nickname: string;
  ip: string;
  location: string;
  userAgent: string;
  /** 解析后的浏览器（无法识别为空串） */
  browser: string;
  /** 解析后的操作系统 */
  os: string;
  /** 登录时间（ISO 8601） */
  loginAt: string;
  /** 最后活跃时间（令牌最近一次刷新的时间，ISO 8601） */
  lastSeenAt: string;
}

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  /**
   * 在线会话列表（分页）。
   * 数据量上限由索引扫描上限兜住（见 SessionService.listAllSids）：在线会话是"人"的数量级，
   * 不适合按数据库分页的方式实现，先在内存里过滤排序再切片。
   */
  async listOnline(query: Record<string, unknown>): Promise<PageResult<OnlineSessionItem>> {
    const { page, pageSize } = parsePagination(query);
    const records = await this.sessionService.list({
      username: readString(query.username),
      ip: readString(query.ip),
    });
    const offset = (page - 1) * pageSize;
    const list = records.slice(offset, offset + pageSize).map((record) => this.toItem(record));
    return buildPageResult(list, records.length, page, pageSize);
  }

  /**
   * 强制下线单个会话。
   * @param sid 会话 id
   * @throws AppException 404 会话不存在（已被登出 / 已过期 / 传错 id）
   */
  async forceLogoutSession(sid: string): Promise<void> {
    const record = await this.sessionService.read(sid);
    if (!record) {
      throw AppException.notFound('会话不存在或已下线');
    }
    await this.sessionService.remove(sid, record.userId);
    this.logger.log(`[Monitor] 强制下线会话：${record.username} (${sid})`);
  }

  /**
   * 强制下线某用户的全部会话。
   *
   * 除删除会话记录外，**同时记一次用户级登出时间**：这样连"没有 sid 的旧令牌"
   * 也会一并失效（否则运维会看到"踢了但那人还在用"）。
   *
   * @param userId 目标用户 id
   * @returns 被下线的会话数
   */
  async forceLogoutUser(userId: number): Promise<number> {
    const removed = await this.sessionService.removeAllOfUser(userId);
    await this.blacklist.recordLogout(userId);
    this.logger.log(`[Monitor] 强制下线用户全部会话：userId=${userId}，共 ${removed} 个`);
    return removed;
  }

  /** 会话记录 → 对外结构（含 UA 解析）。 */
  private toItem(record: SessionRecord): OnlineSessionItem {
    const { browser, os } = parseUserAgent(record.userAgent);
    return {
      sid: record.sid,
      userId: record.userId,
      username: record.username,
      nickname: record.nickname,
      ip: record.ip,
      location: record.location,
      userAgent: record.userAgent,
      browser: browser ?? '',
      os: os ?? '',
      loginAt: new Date(record.loginAt).toISOString(),
      lastSeenAt: new Date(record.lastSeenAt).toISOString(),
    };
  }
}
