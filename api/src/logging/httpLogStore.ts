/**
 * HTTP 访问日志存储层。
 * 模块职责：`sys_http_log` 表的写入、分页查询与清空。
 * 本模块是唯一持有 `HttpLog` 模型的日志模块，避免循环依赖。
 *
 * 约定：
 * - 写入失败绝不影响业务：`appendHttpLog` 内部吞异常并 console.error。
 * - 「清空」只清数据库表（TRUNCATE），物理文件（logs/access/）不受影响。
 */
import { Op, type WhereOptions } from 'sequelize';
import { HttpLog } from '@/models';
import { buildPageResult } from '@/utils/pagination';
import type { PageResult } from '@/types';
import type { AccessLogRecord, HttpLogItem, HttpLogQuery } from './types';

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
    });
  } catch (error) {
    console.error('[HttpLogStore] 写入 HTTP 访问日志失败:', error);
  }
}

/**
 * 分页查询 HTTP 访问日志（按时间倒序）。
 * @param query 查询条件
 * @returns 统一分页结果
 */
export async function queryHttpLogs(query: HttpLogQuery): Promise<PageResult<HttpLogItem>> {
  const where: WhereOptions = {};
  if (query.method) {
    where.method = query.method.toUpperCase();
  }
  if (query.statusCode !== undefined) {
    where.statusCode = query.statusCode;
  }
  const range = buildTimeRange(query.startTime, query.endTime);
  if (range) {
    where.time = range;
  }

  const { rows, count } = await HttpLog.findAndCountAll({
    where,
    order: [
      ['time', 'DESC'],
      ['id', 'DESC'],
    ],
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  });

  const list: HttpLogItem[] = rows.map((row) => ({
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
  }));

  return buildPageResult(list, count, query.page, query.pageSize);
}

/**
 * 清空所有 HTTP 访问日志（TRUNCATE 数据库表；物理文件不受影响）。
 */
export async function clearHttpLogsDb(): Promise<void> {
  await HttpLog.truncate();
}
