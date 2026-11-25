/**
 * IP 访问控制规则服务。
 * 模块职责：规则 CRUD；为中间件提供「按 IP 判定放行 / 拦截」的高频查询能力。
 *
 * 性能取舍（与 config.service 的取值缓存同源）：
 * - 中间件在每个请求上都要判定，直接查库不可接受。故用**进程内快照缓存**（30s TTL），
 *   写操作后立即失效，单实例内严格一致；多实例最坏 30s 延迟（规则变更是低频运维动作）。
 * - 命中次数若每请求写库会造成写放大，故走 Redis 原子自增（可选，Redis 未配时静默降级为不计数）。
 *
 * 匹配优先级（关键）：白名单 > 黑名单。
 * 这样「先误封了管理员 IP，再加白名单自救」能立即生效；也允许白名单绕过限流。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { isValidIpRule, matchIpRule } from '../../common/ip/ip-match.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import { recordAfter, recordBefore } from '../../common/log/operation-snapshot.js';
import type { CreateIpRuleDto, UpdateIpRuleDto } from './dto/ip-rule.dto.js';

/** 规则类型。 */
export const IP_RULE_TYPE = { BLACKLIST: 1, WHITELIST: 2 } as const;

/** 快照缓存 TTL（毫秒）。 */
const SNAPSHOT_TTL_MS = 30_000;
/** 命中计数保留期（毫秒）：30 天，长期不用的规则自然清零。 */
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 对外 DTO。 */
export interface IpRuleItem {
  id: number;
  ip: string;
  ruleType: number;
  remark: string | null;
  status: number;
  expiresAt: Date | null;
  /** 是否被时间或状态判定为当前无效（仅列表展示用） */
  expired: boolean;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SnapshotRow {
  id: number;
  ip: string;
  ruleType: number;
}

interface RuleSnapshot {
  whitelist: SnapshotRow[];
  blacklist: SnapshotRow[];
  expiresAt: number;
}

/** 判定结果：null = 不干涉（继续走后续中间件）。 */
export interface IpDecision {
  allowed: boolean;
  matchedId: number | null;
}

@Injectable()
export class IpRuleService {
  private snapshot: RuleSnapshot | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 命中计数键。 */
  private hitKey(id: number): string {
    return `iprule:hit:${id}`;
  }

  /** 读快照（懒加载 + TTL；写操作后由 invalidate 立即清空）。 */
  private async getSnapshot(): Promise<RuleSnapshot> {
    if (this.snapshot && this.snapshot.expiresAt > Date.now()) {
      return this.snapshot;
    }
    const rows = await this.prisma.ipRule.findMany({
      where: { status: 1 },
      select: { id: true, ip: true, ruleType: true, expiresAt: true },
      orderBy: { id: 'asc' },
    });
    const now = Date.now();
    const active = rows.filter((row) => row.expiresAt === null || row.expiresAt.getTime() > now);
    const toRow = (row: (typeof active)[number]): SnapshotRow => ({
      id: Number(row.id),
      ip: row.ip,
      ruleType: Number(row.ruleType),
    });
    this.snapshot = {
      whitelist: active.filter((row) => Number(row.ruleType) === IP_RULE_TYPE.WHITELIST).map(toRow),
      blacklist: active.filter((row) => Number(row.ruleType) === IP_RULE_TYPE.BLACKLIST).map(toRow),
      expiresAt: now + SNAPSHOT_TTL_MS,
    };
    return this.snapshot;
  }

  /** 写操作后立即失效快照。 */
  private invalidate(): void {
    this.snapshot = null;
  }

  /**
   * 判定一个 IP 是否被规则拦截。
   * 白名单优先（自救通道）：命中白名单直接放行；否则命中黑名单拦截。
   */
  async decide(ip: string): Promise<IpDecision> {
    if (!ip) {
      return { allowed: true, matchedId: null };
    }
    let snapshot: RuleSnapshot;
    try {
      snapshot = await this.getSnapshot();
    } catch {
      // 规则表不可用时放行：访问控制是防护，不能因为数据库抖动把所有人挡在门外。
      return { allowed: true, matchedId: null };
    }
    const hit = (rules: SnapshotRow[]): SnapshotRow | undefined => rules.find((rule) => matchIpRule(ip, rule.ip));

    const white = hit(snapshot.whitelist);
    if (white) {
      return { allowed: true, matchedId: null };
    }
    const black = hit(snapshot.blacklist);
    if (black) {
      // 命中计数 fire-and-forget：Redis 不可用时 incrWithTtl 返回 0，不影响拦截判定
      void this.redis.incrWithTtl(this.hitKey(black.id), HIT_TTL_MS);
      return { allowed: false, matchedId: black.id };
    }
    return { allowed: true, matchedId: null };
  }

  /** 分页列表（命中数从 Redis 合并，读失败按 0 处理）。 */
  async listRules(query: Record<string, unknown>): Promise<PageResult<IpRuleItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const ip = readString(query.ip);
    const ruleType = readNumber(query.ruleType);
    const status = readNumber(query.status);

    const where = {
      ...(ip ? { ip: { contains: ip } } : {}),
      ...(ruleType ? { ruleType } : {}),
      ...(status !== undefined ? { status } : {}),
    };
    const [rows, count] = await Promise.all([
      this.prisma.ipRule.findMany({ where, orderBy: { id: 'asc' }, skip: offset, take: limit }),
      this.prisma.ipRule.count({ where }),
    ]);
    const now = Date.now();
    const items = await Promise.all(
      rows.map(async (row): Promise<IpRuleItem> => {
        const hits = await this.redis.get(this.hitKey(Number(row.id)));
        return {
          id: Number(row.id),
          ip: row.ip,
          ruleType: Number(row.ruleType),
          remark: row.remark,
          status: Number(row.status),
          expiresAt: row.expiresAt,
          expired: row.expiresAt !== null && row.expiresAt.getTime() <= now,
          hitCount: Number(hits ?? 0),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
    );
    return buildPageResult(items, count, page, pageSize);
  }

  /** 详情。 */
  async getRule(id: number): Promise<IpRuleItem> {
    const row = await this.prisma.ipRule.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('IP 规则不存在');
    }
    const hits = await this.redis.get(this.hitKey(id));
    return {
      id,
      ip: row.ip,
      ruleType: Number(row.ruleType),
      remark: row.remark,
      status: Number(row.status),
      expiresAt: row.expiresAt,
      expired: row.expiresAt !== null && row.expiresAt.getTime() <= Date.now(),
      hitCount: Number(hits ?? 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** 新增规则。 */
  async createRule(input: CreateIpRuleDto, createdBy: number): Promise<IpRuleItem> {
    if (!isValidIpRule(input.ip)) {
      throw AppException.badRequest('IP 规则格式不正确（仅支持 IPv4 地址或 CIDR）');
    }
    const exists = await this.prisma.ipRule.findUnique({ where: { ip: input.ip } });
    if (exists) {
      throw AppException.conflict('该 IP 规则已存在');
    }
    const row = await this.prisma.ipRule.create({
      data: {
        ip: input.ip,
        ruleType: input.ruleType,
        remark: input.remark || null,
        status: 1,
        expiresAt: parseExpiresAt(input.expiresAt),
        createdBy: BigInt(createdBy),
      },
    });
    this.invalidate();
    return this.getRule(Number(row.id));
  }

  /** 编辑规则（ip 不可改）。 */
  async updateRule(id: number, input: UpdateIpRuleDto): Promise<IpRuleItem> {
    const existing = await this.prisma.ipRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('IP 规则不存在');
    }
    recordBefore({
      ip: existing.ip,
      ruleType: Number(existing.ruleType),
      remark: existing.remark,
      status: Number(existing.status),
      expiresAt: existing.expiresAt,
    });
    const row = await this.prisma.ipRule.update({
      where: { id: BigInt(id) },
      data: {
        ruleType: input.ruleType,
        remark: input.remark || null,
        expiresAt: parseExpiresAt(input.expiresAt),
      },
    });
    recordAfter({
      ip: row.ip,
      ruleType: Number(row.ruleType),
      remark: row.remark,
      status: Number(row.status),
      expiresAt: row.expiresAt,
    });
    this.invalidate();
    return this.getRule(id);
  }

  /** 启停规则。 */
  async toggleStatus(id: number): Promise<IpRuleItem> {
    const existing = await this.prisma.ipRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('IP 规则不存在');
    }
    await this.prisma.ipRule.update({
      where: { id: BigInt(id) },
      data: { status: Number(existing.status) === 1 ? 0 : 1 },
    });
    this.invalidate();
    return this.getRule(id);
  }

  /** 删除规则（同时清掉 Redis 命中计数）。 */
  async deleteRule(id: number): Promise<void> {
    const existing = await this.prisma.ipRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('IP 规则不存在');
    }
    await this.prisma.ipRule.delete({ where: { id: BigInt(id) } });
    await this.redis.del(this.hitKey(id));
    this.invalidate();
  }

  /** 清空命中计数。 */
  async clearHitCount(id: number): Promise<void> {
    const existing = await this.prisma.ipRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('IP 规则不存在');
    }
    await this.redis.del(this.hitKey(id));
  }
}

/** 解析过期时间字符串；非法值按「永久」处理，避免脏字符串写进库。 */
function parseExpiresAt(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
