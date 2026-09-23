/**
 * 日志服务。
 * 模块职责：登录/操作日志查询与写入、HTTP 访问日志读取、日志导出（CSV）。
 */
import { formatDateTimeInZone } from '@/utils/datetime';
import { Op, type WhereOptions } from 'sequelize';
import { LoginLog, OperationLog } from '@/models';
import type { PageResult } from '@/types';
import { clearAccessLog, readHttpLogs } from '@/utils/logger';
import { buildPageResult, parsePagination } from '@/utils/pagination';

/** 操作日志写入参数。 */
export interface OperationLogInput {
  userId: number | null;
  username: string | null;
  module: string;
  action: string;
  method: string;
  url: string;
  params: string | null;
  duration: number;
  result: number;
  errorMessage: string | null;
  ip: string | null;
}

/** 登录日志列表项。 */
export interface LoginLogItem {
  id: number;
  username: string;
  ip: string | null;
  userAgent: string | null;
  status: number;
  message: string | null;
  loginAt: Date;
}

/** 操作日志列表项。 */
export interface OperationLogItem {
  id: number;
  userId: number | null;
  username: string | null;
  module: string;
  action: string;
  method: string;
  url: string;
  params: string | null;
  duration: number;
  result: number;
  errorMessage: string | null;
  ip: string | null;
  createdAt: Date;
}

/**
 * HTTP 访问日志列表项（对外 API 契约）。
 * 注意：日志文件内的字段名是 status / responseTime，
 * 对外统一映射为 statusCode / duration，与前端 HttpLog 类型对齐。
 */
export interface HttpLogItem {
  id: number;
  time: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent: string;
  /** 请求查询参数（已脱敏） */
  query?: Record<string, unknown>;
  /** 请求体（已脱敏、截断） */
  reqBody?: string;
  /** 响应内容（已截断；二进制为占位说明） */
  resBody?: string;
}

/** 解析时间范围查询条件（无有效值时返回 undefined）。 */
function buildDateRange(startTime?: unknown, endTime?: unknown): WhereOptions | undefined {
  const gte = typeof startTime === 'string' && startTime ? new Date(startTime) : undefined;
  const lte = typeof endTime === 'string' && endTime ? new Date(endTime) : undefined;
  if (!gte && !lte) {
    return undefined;
  }
  const range: Record<string | symbol, Date> = {};
  if (gte) {
    range[Op.gte] = gte;
  }
  if (lte) {
    range[Op.lte] = lte;
  }
  return range as unknown as WhereOptions;
}

/**
 * 写入操作日志（失败不抛出，避免影响主流程）。
 * @param input 日志内容
 */
export async function createOperationLog(input: OperationLogInput): Promise<void> {
  try {
    await OperationLog.create({ ...input });
  } catch (error) {
    console.error('[LogService] 写入操作日志失败:', error);
  }
}

/**
 * 分页查询登录日志。
 * @param query 查询参数
 */
export async function listLoginLogs(query: Record<string, unknown>): Promise<PageResult<LoginLogItem>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const username = typeof query.username === 'string' ? query.username.trim() : '';
  if (username) {
    where.username = { [Op.like]: `%${username}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }
  const range = buildDateRange(query.startTime, query.endTime);
  if (range) {
    where.loginAt = range;
  }

  const { rows, count } = await LoginLog.findAndCountAll({
    where,
    order: [
      ['loginAt', 'DESC'],
      ['id', 'DESC'],
    ],
    offset,
    limit,
  });

  const list: LoginLogItem[] = rows.map((row) => ({
    id: Number(row.id),
    username: row.username,
    ip: row.ip,
    userAgent: row.userAgent,
    status: Number(row.status),
    message: row.message,
    loginAt: row.loginAt,
  }));

  return buildPageResult(list, count, page, pageSize);
}

/**
 * 分页查询操作日志。
 * @param query 查询参数
 */
export async function listOperationLogs(query: Record<string, unknown>): Promise<PageResult<OperationLogItem>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const module = typeof query.module === 'string' ? query.module.trim() : '';
  if (module) {
    where.module = { [Op.like]: `%${module}%` };
  }
  const username = typeof query.username === 'string' ? query.username.trim() : '';
  if (username) {
    where.username = { [Op.like]: `%${username}%` };
  }
  if (query.result !== undefined && query.result !== '') {
    where.result = Number(query.result);
  }
  const range = buildDateRange(query.startTime, query.endTime);
  if (range) {
    where.createdAt = range;
  }

  const { rows, count } = await OperationLog.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset,
    limit,
  });

  const list: OperationLogItem[] = rows.map((row) => ({
    id: Number(row.id),
    userId: row.userId === null ? null : Number(row.userId),
    username: row.username,
    module: row.module,
    action: row.action,
    method: row.method,
    url: row.url,
    params: row.params,
    duration: Number(row.duration),
    result: Number(row.result),
    errorMessage: row.errorMessage,
    ip: row.ip,
    createdAt: row.createdAt,
  }));

  return buildPageResult(list, count, page, pageSize);
}

/**
 * 分页查询 HTTP 访问日志（从日志文件读取）。
 * @param query 查询参数
 */
export async function listHttpLogs(query: Record<string, unknown>): Promise<PageResult<HttpLogItem>> {
  const { page, pageSize } = parsePagination(query);
  const { list, total } = readHttpLogs({
    page,
    pageSize,
    method: typeof query.method === 'string' ? query.method : undefined,
    statusCode: query.statusCode !== undefined && query.statusCode !== '' ? Number(query.statusCode) : undefined,
    startTime: typeof query.startTime === 'string' ? query.startTime : undefined,
    endTime: typeof query.endTime === 'string' ? query.endTime : undefined,
  });

  const items: HttpLogItem[] = list.map((record, index) => ({
    id: (page - 1) * pageSize + index + 1,
    time: record.time,
    method: record.method,
    url: record.url,
    statusCode: record.status,
    duration: record.responseTime,
    ip: record.ip,
    userAgent: record.userAgent,
    query: record.query,
    reqBody: record.reqBody,
    resBody: record.resBody,
  }));

  return buildPageResult(items, total, page, pageSize);
}

/**
 * 清空所有 HTTP 访问日志（截断访问日志文件）。
 */
export async function clearHttpLogs(): Promise<void> {
  await clearAccessLog();
}

/** 转义 CSV 单元格。 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** 将行数据转换为 CSV 字符串（含 UTF-8 BOM）。 */
function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  rows.forEach((row) => lines.push(row.map(csvCell).join(',')));
  return `\uFEFF${lines.join('\r\n')}`;
}

/**
 * 导出登录日志 CSV。
 * @param query 筛选条件
 */
export async function exportLoginLogs(query: Record<string, unknown>, timezoneOffset?: number): Promise<string> {
  const { list } = await listLoginLogs({ ...query, page: 1, pageSize: 10000 });
  const rows = list.map((item) => [
    item.id,
    item.username,
    item.ip,
    item.status === 1 ? '成功' : '失败',
    item.message,
    item.userAgent,
    formatDateTimeInZone(item.loginAt, timezoneOffset),
  ]);
  return toCsv(['ID', '账号', 'IP', '结果', '描述', 'User-Agent', '登录时间'], rows);
}

/**
 * 导出操作日志 CSV。
 * @param query 筛选条件
 */
export async function exportOperationLogs(query: Record<string, unknown>, timezoneOffset?: number): Promise<string> {
  const { list } = await listOperationLogs({ ...query, page: 1, pageSize: 10000 });
  const rows = list.map((item) => [
    item.id,
    item.module,
    item.action,
    item.username,
    item.method,
    item.url,
    item.params,
    `${item.duration}ms`,
    item.result === 1 ? '成功' : '失败',
    item.errorMessage,
    item.ip,
    formatDateTimeInZone(item.createdAt, timezoneOffset),
  ]);
  return toCsv(['ID', '模块', '动作', '操作人', '方法', 'URL', '参数', '耗时', '结果', '错误信息', 'IP', '时间'], rows);
}
