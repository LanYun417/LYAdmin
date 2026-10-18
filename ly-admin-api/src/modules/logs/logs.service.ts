/**
 * 日志服务。
 * 模块职责：登录/操作/HTTP 访问日志查询与导出（CSV），HTTP 日志浏览器/操作系统由 UA 解析。
 */
import { Injectable } from '@nestjs/common';
import { config } from '../../common/config/config.js';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, formatDateTimeInZone, parsePagination, readString } from '../../common/utils/utils.js';
import { parseUserAgent } from '../../common/utils/user-agent.js';

/** HTTP 日志 count 缓存 TTL（毫秒）。 */
const COUNT_CACHE_TTL_MS = 30_000;

/** count 缓存条目。 */
interface CountCacheEntry {
  total: number;
  expiresAt: number;
}

/** HTTP 日志摘要（列表 / CSV 用，不含请求体与响应体）。 */
interface HttpLogItem {
  id: number;
  time: Date;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  location: string;
  userAgent: string;
  userId: number;
  deptId: number;
  username: string;
  deptName: string;
  browser: string;
  os: string;
}

/** HTTP 日志详情（展开行 / 详情接口用）。 */
interface HttpLogDetail extends HttpLogItem {
  query: unknown;
  reqBody: string | null;
  resBody: string | null;
}

/** 列表与导出只取摘要列，避免把 Text 类型的请求/响应体读进内存。 */
const HTTP_LOG_SUMMARY_SELECT = {
  id: true,
  time: true,
  method: true,
  url: true,
  statusCode: true,
  duration: true,
  ip: true,
  location: true,
  userAgent: true,
  userId: true,
  username: true,
  deptId: true,
  deptName: true,
} as const;

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

/**
 * 构造登录日志查询条件。
 * 抽成模块函数而非类内私有方法：列表分页与 CSV 导出必须用**同一套**条件，
 * 否则会出现「列表看到 20 条、导出少了几条」这类无法自查的偏差。
 */
function buildLoginWhere(query: Record<string, unknown>): Record<string, unknown> {
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
  return where;
}

/** 构造操作日志查询条件（与列表共用）。 */
function buildOperationWhere(query: Record<string, unknown>): Record<string, unknown> {
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
  return where;
}

/** 登录日志行 → 对外结构（列表与导出共用）。 */
function mapLoginRow(row: {
  id: bigint;
  username: string;
  ip: string | null;
  location: string | null;
  userAgent: string | null;
  status: number;
  message: string | null;
  loginAt: Date;
}): {
  id: number;
  username: string;
  ip: string | null;
  location: string | null;
  userAgent: string | null;
  status: number;
  message: string | null;
  loginAt: Date;
} {
  return {
    id: Number(row.id),
    username: row.username,
    ip: row.ip,
    location: row.location,
    userAgent: row.userAgent,
    status: Number(row.status),
    message: row.message,
    loginAt: row.loginAt,
  };
}

/** 操作日志行 → 对外结构（列表与导出共用）。 */
function mapOperationRow(row: {
  id: bigint;
  userId: bigint | null;
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
  location: string | null;
  createdAt: Date;
}): {
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
  location: string | null;
  createdAt: Date;
} {
  return {
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
    location: row.location,
    createdAt: row.createdAt,
  };
}

/** 导出任务描述：控制器据此流式写出，服务层不接触响应对象。 */
export interface CsvExportTask {
  /** 下载文件名 */
  filename: string;
  /** 表头 */
  header: string[];
  /** 行数（已通过上限预检） */
  total: number;
  /** 分批行数据（每批为二维数组） */
  rows: AsyncGenerator<unknown[][]>;
}

/** 三类日志的 CSV 表头（列表展示与导出列顺序一致）。 */
const LOGIN_LOG_CSV_HEADER = ['ID', '账号', 'IP', '归属地', '结果', '描述', 'User-Agent', '登录时间'];
const OPERATION_LOG_CSV_HEADER = [
  'ID',
  '模块',
  '动作',
  '操作人',
  '方法',
  'URL',
  '参数',
  '耗时',
  '结果',
  '错误信息',
  'IP',
  '归属地',
  '时间',
];
const HTTP_LOG_CSV_HEADER = [
  'ID',
  '时间',
  '方法',
  'URL',
  '状态码',
  '耗时',
  '操作人',
  '所属部门',
  '浏览器',
  '操作系统',
  'IP',
  '归属地',
  'User-Agent',
];

/**
 * 导出行数上限预检。
 * 超限时抛 400 而不是「截断后照常导出」：半截 CSV 会被当成完整数据使用，比报错更危险。
 * `EXPORT_MAX_ROWS=0` 表示不限制（不建议）。
 */
function assertExportable(total: number, label: string): void {
  const max = config.export.maxRows;
  if (max > 0 && total > max) {
    throw AppException.badRequest(
      `待导出的${label}共 ${total} 条，超过单次导出上限 ${max} 条；请缩小时间范围或补充筛选条件`,
    );
  }
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页查询登录日志。 */
  async listLoginLogs(query: Record<string, unknown>): Promise<unknown> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = buildLoginWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.loginLog.findMany({
        where,
        orderBy: [{ loginAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.loginLog.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => mapLoginRow(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 分页查询操作日志。 */
  async listOperationLogs(query: Record<string, unknown>): Promise<unknown> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = buildOperationWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.operationLog.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => mapOperationRow(row)),
      total,
      page,
      pageSize,
    );
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
      // 前缀匹配（而非 %x%）：可命中 username 索引，避免大表全表扫描
      where.username = { startsWith: username };
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

  /** 摘要映射（含 UA 解析的 browser/os）。 */
  private mapHttpLogSummary(row: {
    id: bigint;
    time: Date;
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    ip: string | null;
    location: string | null;
    userAgent: string | null;
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
      location: row.location ?? '',
      userAgent: row.userAgent ?? '',
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
      select: HTTP_LOG_SUMMARY_SELECT,
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

    const list = rows.map((row) => this.mapHttpLogSummary(row));
    return buildPageResult(list, total, page, pageSize);
  }

  /** HTTP 日志详情（请求 / 响应体按需单独取，列表不携带）。 */
  async getHttpLogDetail(id: number): Promise<HttpLogDetail> {
    const row = await this.prisma.httpLog.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('日志不存在');
    }
    return {
      ...this.mapHttpLogSummary(row),
      query: row.query ?? null,
      reqBody: row.reqBody ?? null,
      resBody: row.resBody ?? null,
    };
  }

  /** 清空所有 HTTP 访问日志。 */
  async clearHttpLogs(): Promise<void> {
    await this.prisma.httpLog.deleteMany({});
    countCache.clear();
  }

  /** 删除登录日志（按 id 批量，返回实际删除条数；单条删除传单元素数组）。 */
  async deleteLoginLogs(ids: number[]): Promise<number> {
    const { count } = await this.prisma.loginLog.deleteMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
    });
    return count;
  }

  /** 删除操作日志（按 id 批量，返回实际删除条数）。 */
  async deleteOperationLogs(ids: number[]): Promise<number> {
    const { count } = await this.prisma.operationLog.deleteMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
    });
    return count;
  }

  /** 删除 HTTP 访问日志（按 id 批量，返回实际删除条数；count 缓存一并失效）。 */
  async deleteHttpLogs(ids: number[]): Promise<number> {
    const { count } = await this.prisma.httpLog.deleteMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
    });
    if (count > 0) {
      countCache.clear();
    }
    return count;
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

  /**
   * 构造登录日志导出任务（流式）。
   * 先按筛选条件 count：超上限直接抛 400——此时尚未写响应头，前端能拿到正常的 JSON 错误，
   * 而不是「下载了一个只有一半数据的 CSV」。
   */
  async createLoginLogExport(query: Record<string, unknown>, timezoneOffset?: number): Promise<CsvExportTask> {
    const where = buildLoginWhere(query);
    const total = await this.prisma.loginLog.count({ where });
    assertExportable(total, '登录日志');
    return {
      filename: `login-logs-${Date.now()}.csv`,
      header: LOGIN_LOG_CSV_HEADER,
      total,
      rows: this.loginLogBatches(where, config.export.batchSize, timezoneOffset),
    };
  }

  /**
   * 登录日志分批取数。
   * 用游标（`cursor: { id }` + `skip: 1`）而非 offset 深分页：日志表下 offset 越大越慢，
   * 且导出期间新写入会导致 offset 分页重复/漏行；游标按主键推进则稳定。
   */
  private async *loginLogBatches(
    where: Record<string, unknown>,
    batchSize: number,
    timezoneOffset?: number,
  ): AsyncGenerator<unknown[][]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.loginLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take: batchSize,
        ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      });
      if (rows.length === 0) {
        return;
      }
      cursorId = rows[rows.length - 1]!.id;
      yield rows.map((row) => {
        const item = mapLoginRow(row);
        return [
          item.id,
          item.username,
          item.ip,
          item.location,
          item.status === 1 ? '成功' : '失败',
          item.message,
          item.userAgent,
          formatDateTimeInZone(item.loginAt, timezoneOffset),
        ];
      });
      if (rows.length < batchSize) {
        return;
      }
    }
  }

  /** 构造操作日志导出任务（流式，上限预检同登录日志）。 */
  async createOperationLogExport(query: Record<string, unknown>, timezoneOffset?: number): Promise<CsvExportTask> {
    const where = buildOperationWhere(query);
    const total = await this.prisma.operationLog.count({ where });
    assertExportable(total, '操作日志');
    return {
      filename: `operation-logs-${Date.now()}.csv`,
      header: OPERATION_LOG_CSV_HEADER,
      total,
      rows: this.operationLogBatches(where, config.export.batchSize, timezoneOffset),
    };
  }

  /** 操作日志分批取数（游标分页，理由见 loginLogBatches）。 */
  private async *operationLogBatches(
    where: Record<string, unknown>,
    batchSize: number,
    timezoneOffset?: number,
  ): AsyncGenerator<unknown[][]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.operationLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take: batchSize,
        ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      });
      if (rows.length === 0) {
        return;
      }
      cursorId = rows[rows.length - 1]!.id;
      yield rows.map((row) => {
        const item = mapOperationRow(row);
        return [
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
          item.location,
          formatDateTimeInZone(item.createdAt, timezoneOffset),
        ];
      });
      if (rows.length < batchSize) {
        return;
      }
    }
  }

  /** 构造 HTTP 访问日志导出任务（流式；上限预检同其它日志）。 */
  async createHttpLogExport(query: Record<string, unknown>, timezoneOffset?: number): Promise<CsvExportTask> {
    const where = this.buildHttpWhere(query);
    const total = await this.prisma.httpLog.count({ where });
    assertExportable(total, 'HTTP 访问日志');
    return {
      filename: `http-logs-${Date.now()}.csv`,
      header: HTTP_LOG_CSV_HEADER,
      total,
      rows: this.httpLogBatches(where, config.export.batchSize, timezoneOffset),
    };
  }

  /** HTTP 日志分批取数（游标分页；UA 解析逐行做，不额外占内存）。 */
  private async *httpLogBatches(
    where: Record<string, unknown>,
    batchSize: number,
    timezoneOffset?: number,
  ): AsyncGenerator<unknown[][]> {
    let cursorId: bigint | undefined;
    for (;;) {
      const rows = await this.prisma.httpLog.findMany({
        where,
        select: HTTP_LOG_SUMMARY_SELECT,
        orderBy: { id: 'desc' },
        take: batchSize,
        ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      });
      if (rows.length === 0) {
        return;
      }
      cursorId = rows[rows.length - 1]!.id;
      yield rows.map((row) => {
        const item = this.mapHttpLogSummary(row);
        return [
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
          item.location || '-',
          item.userAgent,
        ];
      });
      if (rows.length < batchSize) {
        return;
      }
    }
  }
}
