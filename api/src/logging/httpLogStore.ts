/**
 * HTTP 访问日志存储层。
 * 模块职责：`sys_http_log` 表的写入、分页查询与清空。
 * 本模块是唯一持有 `HttpLog` 模型的日志模块，避免循环依赖。
 *
 * 约定：
 * - 写入失败绝不影响业务：`appendHttpLog` 内部吞异常并 console.error。
 * - 「清空」只清数据库表（TRUNCATE），物理文件（logs/access/）不受影响。
 *
 * 性能（日志治理 ④）：`sys_http_log` 为大表，`count(*)` 代价高。为 `count` 结果加**进程内短 TTL
 * 缓存（30s）**：仍返回**精确** `total`，最多 30 秒陈旧；缓存键包含全部筛选条件（method/statusCode/
 * startTime/endTime/username/deptId），不同筛选各自计数，绝不串数。**不改变接口返回契约**（不做近似计数 / hasMore 模式）。
 * 注：浏览器 / 操作系统由 `userAgent` 在**返回当前页时**解析（带缓存），不进入 SQL 与 count。
 */
import { Op, type WhereOptions } from 'sequelize';
import { config } from '@/config';
import { HttpLog } from '@/models';
import { buildPageResult } from '@/utils/pagination';
import { parseUserAgent } from '@/utils/userAgent';
import type { PageResult } from '@/types';
import type { AccessLogRecord, HttpLogItem, HttpLogQuery } from './types';

/** HTTP 日志 count 缓存的 TTL（毫秒）。 */
const COUNT_CACHE_TTL_MS = 30_000;

/** count 缓存条目。 */
interface CountCacheEntry {
  /** 缓存的精确总数 */
  total: number;
  /** 过期时间戳（ms） */
  expiresAt: number;
}

/** count 缓存：键为筛选条件序列化串，值为精确总数 + 过期时间。 */
const countCache = new Map<string, CountCacheEntry>();

/**
 * 由查询条件构造 count 缓存键（必须包含全部筛选参数，否则不同筛选会串数）。
 * 说明：总数只与筛选条件相关，与 page / pageSize 无关，故不纳入键。
 * @param query 查询条件
 * @returns 缓存键
 */
function buildCountCacheKey(query: HttpLogQuery): string {
  return JSON.stringify({
    method: query.method ? query.method.toUpperCase() : '',
    statusCode: query.statusCode ?? null,
    startTime: query.startTime ?? '',
    endTime: query.endTime ?? '',
    username: query.username ?? '',
    deptId: query.deptId ?? null,
  });
}

/**
 * 读取 count 缓存（过期即失效并移除）。
 * @param key 缓存键
 * @returns 命中的精确总数；未命中或已过期返回 null
 */
function readCachedCount(key: string): number | null {
  const entry = countCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    countCache.delete(key);
    return null;
  }
  return entry.total;
}

/**
 * 写入 count 缓存。
 * @param key 缓存键
 * @param total 精确总数
 */
function writeCachedCount(key: string, total: number): void {
  countCache.set(key, { total, expiresAt: Date.now() + COUNT_CACHE_TTL_MS });
}

/**
 * 清空 count 缓存（清空全部日志 / 按保留期清理后调用，避免返回陈旧 total）。
 */
export function clearHttpLogCountCache(): void {
  countCache.clear();
}

/**
 * 构造时间范围查询条件（无效值忽略；无有效值时返回 undefined）。
 * @param startTime 起始时间（ISO 字符串）
 * @param endTime 结束时间（ISO 字符串）
 */
function buildTimeRange(startTime?: string, endTime?: string): WhereOptions | undefined {
  const gte = startTime ? new Date(startTime) : undefined;
  const lte = endTime ? new Date(endTime) : undefined;
  const hasGte = gte !== undefined && !Number.isNaN(gte.getTime());
  const hasLte = lte !== undefined && !Number.isNaN(lte.getTime());
  if (!hasGte && !hasLte) {
    return undefined;
  }
  const range: Record<string | symbol, Date> = {};
  if (hasGte) {
    range[Op.gte] = gte as Date;
  }
  if (hasLte) {
    range[Op.lte] = lte as Date;
  }
  return range as unknown as WhereOptions;
}

/**
 * 写入一条 HTTP 访问日志到数据库（失败不抛出）。
 * @param record 访问日志记录
 */
export async function appendHttpLog(record: AccessLogRecord): Promise<void> {
  try {
    await HttpLog.create({
      time: new Date(record.time),
      method: record.method,
      url: record.url,
      statusCode: record.status,
      duration: record.responseTime,
      ip: record.ip || null,
      userAgent: record.userAgent || null,
      query: record.query ?? null,
      reqBody: record.reqBody ?? null,
      resBody: record.resBody ?? null,
      userId: record.userId ?? 0,
      username: record.username ?? null,
      deptId: record.deptId ?? 0,
      deptName: record.deptName ?? null,
    });
  } catch (error) {
    console.error('[HttpLogStore] 写入 HTTP 访问日志失败:', error);
  }
}

/**
 * 分页查询 HTTP 访问日志（按时间倒序）。
 * 行数据照常查询；`total` 走 30s 短 TTL 缓存（键含全部筛选条件），未命中才做精确 `count(*)`。
 * @param query 查询条件
 * @returns 统一分页结果（`total` 为精确值，最多 30 秒陈旧）
 */
export async function queryHttpLogs(query: HttpLogQuery): Promise<PageResult<HttpLogItem>> {
  const where: WhereOptions = {};
  if (query.method) {
    where.method = query.method.toUpperCase();
  }
  if (query.statusCode !== undefined) {
    where.statusCode = query.statusCode;
  }
  const username = query.username?.trim();
  if (username) {
    where.username = { [Op.like]: `%${username}%` };
  }
  if (query.deptId !== undefined) {
    where.deptId = query.deptId;
  }
  const range = buildTimeRange(query.startTime, query.endTime);
  if (range) {
    where.time = range;
  }

  const rows = await HttpLog.findAll({
    where,
    order: [
      ['time', 'DESC'],
      ['id', 'DESC'],
    ],
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  });

  // count 缓存：先查缓存，未命中再做精确 count(*) 并写回
  const cacheKey = buildCountCacheKey(query);
  let total = readCachedCount(cacheKey);
  if (total === null) {
    total = await HttpLog.count({ where });
    writeCachedCount(cacheKey, total);
    if (config.log.httpCountCacheDebug) {
      console.log(`[HttpLogStore] count 未命中缓存，精确计算 total=${total}`);
    }
  } else if (config.log.httpCountCacheDebug) {
    console.log(`[HttpLogStore] count 命中缓存 total=${total}`);
  }

  const list: HttpLogItem[] = rows.map((row) => {
    // UA 解析：带缓存的微秒级正则，且仅作用于当前页行（不影响 count）
    const { browser, os } = parseUserAgent(row.userAgent);
    return {
      id: Number(row.id),
      time: row.time instanceof Date ? row.time.toISOString() : new Date(row.time).toISOString(),
      method: row.method,
      url: row.url,
      statusCode: Number(row.statusCode),
      duration: Number(row.duration),
      ip: row.ip ?? '',
      userAgent: row.userAgent ?? '',
      query: row.query ?? null,
      reqBody: row.reqBody ?? null,
      resBody: row.resBody ?? null,
      userId: Number(row.userId ?? 0),
      username: row.username ?? '',
      deptId: Number(row.deptId ?? 0),
      deptName: row.deptName ?? '',
      browser: browser ?? '',
      os: os ?? '',
    };
  });

  return buildPageResult(list, total, query.page, query.pageSize);
}

/**
 * 清空所有 HTTP 访问日志（TRUNCATE 数据库表；物理文件不受影响）。
 * 同步清空 count 缓存，避免清空后 30 秒内仍返回陈旧 total。
 */
export async function clearHttpLogsDb(): Promise<void> {
  await HttpLog.truncate();
  clearHttpLogCountCache();
}
