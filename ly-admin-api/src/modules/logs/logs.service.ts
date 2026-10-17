/**
 * 日志服务。
 * 模块职责：登录/操作/HTTP 访问日志查询与导出（CSV），HTTP 日志浏览器/操作系统由 UA 解析。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, formatDateTimeInZone, parsePagination, readString, toCsv } from '../../common/utils.js';
import { parseUserAgent } from '../../common/user-agent.js';

/** HTTP 日志 count 缓存 TTL（毫秒）。 */
const COUNT_CACHE_TTL_MS = 30_000;

/** count 缓存条目。 */
interface CountCacheEntry {
  total: number;
  expiresAt: number;
}

/** HTTP 日志对外项（列表与 CSV 共用）。 */
interface HttpLogItem {
  id: number;
  time: Date;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent: string;
  query: unknown;
  reqBody: string | null;
  resBody: string | null;
  userId: number;
  deptId: number;
  username: string;
  deptName: string;
  browser: string;
  os: string;
}

/** HTTP 日志 count 缓存：键含全部筛选条件，避免不同筛选串数（不近似计数，不改契约）。 */
const countCache = new Map<string, CountCacheEntry>();

function readFilterNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function readFilterDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页查询登录日志。 */
  async listLoginLogs(query: Record<string, unknown>): Promise<unknown> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};
    const username = typeof query.username === 'string' ? query.username.trim() : '';
    if (username) {
      where.username = { contains: username };
    }
    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }
    const startTime = readFilterDate(query.startTime);
    const endTime = readFilterDate(query.endTime);
    if (startTime || endTime) {
      const range: Record<string, Date> = {};
      if (startTime) range.gte = startTime;
      if (endTime) range.lte = endTime;
      where.loginAt = range;
    }

    const [rows, total] = await Promise.all([
      this.prisma.loginLog.findMany({
        where,
        orderBy: [{ loginAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.loginLog.count({ where }),
    ]);
    const list = rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      ip: row.ip,
      userAgent: row.userAgent,
      status: Number(row.status),
      message: row.message,
      loginAt: row.loginAt,
    }));
    return buildPageResult(list, total, page, pageSize);
  }

  /** 分页查询操作日志。 */
  async listOperationLogs(query: Record<string, unknown>): Promise<unknown> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = {};
    const moduleName = typeof query.module === 'string' ? query.module.trim() : '';
    if (moduleName) {
      where.module = { contains: moduleName };
    }
    const username = typeof query.username === 'string' ? query.username.trim() : '';
    if (username) {
      where.username = { contains: username };
    }
    if (query.result !== undefined && query.result !== '') {
      where.result = Number(query.result);
    }
    const startTime = readFilterDate(query.startTime);
    const endTime = readFilterDate(query.endTime);
    if (startTime || endTime) {
      const range: Record<string, Date> = {};
      if (startTime) range.gte = startTime;
      if (endTime) range.lte = endTime;
      where.createdAt = range;
    }

    const [rows, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.operationLog.count({ where }),
    ]);
    const list = rows.map((row) => ({
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
    return buildPageResult(list, total, page, pageSize);
  }

  /** 构造 HTTP 日志查询条件。 */
  private buildHttpWhere(query: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    const method = readString(query.method);
    if (method) {
      where.method = method.toUpperCase();
    }
    if (query.statusCode !== undefined && query.statusCode !== '') {
      where.statusCode = Number(query.statusCode);
    }
    const username = typeof query.username === 'string' ? query.username.trim() : '';
    if (username) {
      where.username = { contains: username };
    }
    const deptId = readFilterNumber(query.deptId);
    if (deptId !== undefined) {
      where.deptId = BigInt(deptId);
    }
    const startTime = readFilterDate(query.startTime);
    const endTime = readFilterDate(query.endTime);
    if (startTime || endTime) {
      const range: Record<string, Date> = {};
      if (startTime) range.gte = startTime;
      if (endTime) range.lte = endTime;
      where.time = range;
    }
    return where;
  }

  /** 构造 count 缓存键（含全部筛选条件，page/pageSize 无关）。 */
  private buildCountCacheKey(query: Record<string, unknown>): string {
    return JSON.stringify({
      method: (readString(query.method) ?? '').toUpperCase(),
      statusCode: query.statusCode ?? null,
      startTime: query.startTime ?? '',
      endTime: query.endTime ?? '',
      username: typeof query.username === 'string' ? query.username.trim() : '',
      deptId: query.deptId ?? null,
    });
  }

  /** 按条件把所有 HTTP 日志映射为对外项（含 UA 解析的 browser/os）。 */
  private mapHttpLog(row: {
    id: bigint;
    time: Date;
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    ip: string | null;
    userAgent: string | null;
    query: unknown;
    reqBody: string | null;
    resBody: string | null;
    userId: bigint;
    username: string | null;
    deptId: bigint;
    deptName: string | null;
  }): HttpLogItem {
    const { browser, os } = parseUserAgent(row.userAgent);
    return {
      id: Number(row.id),
      time: row.time,
      method: row.method,
      url: row.url,
      statusCode: Number(row.statusCode),
      duration: Number(row.duration),
      ip: row.ip ?? '',
      userAgent: row.userAgent ?? '',
      query: row.query ?? null,
      reqBody: row.reqBody ?? null,
      resBody: row.resBody ?? null,
      userId: Number(row.userId),
      username: row.username ?? '',
      deptId: Number(row.deptId),
      deptName: row.deptName ?? '',
      browser: browser ?? '',
      os: os ?? '',
    };
  }

  /** 分页查询 HTTP 访问日志（total 走 30s TTL 缓存）。 */
  async listHttpLogs(query: Record<string, unknown>): Promise<unknown> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = this.buildHttpWhere(query);

    const rows = await this.prisma.httpLog.findMany({
      where,
      orderBy: [{ time: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    });

    const cacheKey = this.buildCountCacheKey(query);
    let total = this.readCachedCount(cacheKey);
    if (total === null) {
      total = await this.prisma.httpLog.count({ where });
      this.writeCachedCount(cacheKey, total);
    }

    const list = rows.map((row) => this.mapHttpLog(row));
    return buildPageResult(list, total, page, pageSize);
  }

  /** 清空所有 HTTP 访问日志。 */
  async clearHttpLogs(): Promise<void> {
    await this.prisma.httpLog.deleteMany({});
    countCache.clear();
  }

  private readCachedCount(key: string): number | null {
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

  private writeCachedCount(key: string, total: number): void {
    countCache.set(key, { total, expiresAt: Date.now() + COUNT_CACHE_TTL_MS });
  }

  /** 导出登录日志 CSV。 */
  async exportLoginLogs(query: Record<string, unknown>, timezoneOffset?: number): Promise<string> {
    const { list } = (await this.listLoginLogs({ ...query, page: 1, pageSize: 10000 })) as {
      list: Array<{
        id: number;
        username: string;
        ip: string | null;
        status: number;
        message: string | null;
        userAgent: string | null;
        loginAt: Date;
      }>;
    };
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

  /** 导出操作日志 CSV。 */
  async exportOperationLogs(query: Record<string, unknown>, timezoneOffset?: number): Promise<string> {
    const { list } = (await this.listOperationLogs({ ...query, page: 1, pageSize: 10000 })) as {
      list: Array<{
        id: number;
        module: string;
        action: string;
        username: string | null;
        method: string;
        url: string;
        params: string | null;
        duration: number;
        result: number;
        errorMessage: string | null;
        ip: string | null;
        createdAt: Date;
      }>;
    };
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
    return toCsv(
      ['ID', '模块', '动作', '操作人', '方法', 'URL', '参数', '耗时', '结果', '错误信息', 'IP', '时间'],
      rows,
    );
  }

  /** 导出 HTTP 访问日志 CSV（不走列表分页，直接取 10000 行以保证完整）。 */
  async exportHttpLogs(query: Record<string, unknown>, timezoneOffset?: number): Promise<string> {
    const where = this.buildHttpWhere(query);
    const rows = await this.prisma.httpLog.findMany({
      where,
      orderBy: [{ time: 'desc' }, { id: 'desc' }],
      take: 10000,
    });
    const list = rows.map((row) => this.mapHttpLog(row));
    const csvRows = list.map((item) => [
      item.id,
      formatDateTimeInZone(item.time, timezoneOffset),
      item.method,
      item.url,
      item.statusCode,
      `${item.duration}ms`,
      item.username || '-',
      item.deptName || '-',
      item.browser || '-',
      item.os || '-',
      item.ip,
      item.userAgent,
    ]);
    return toCsv(
      ['ID', '时间', '方法', 'URL', '状态码', '耗时', '操作人', '所属部门', '浏览器', '操作系统', 'IP', 'User-Agent'],
      csvRows,
    );
  }
}
