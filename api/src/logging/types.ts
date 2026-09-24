/**
 * 日志领域类型定义。
 * 模块职责：声明日志类型枚举、各类日志记录结构、对外 API 契约与归档结果类型。
 * 本模块为纯类型模块，不依赖任何运行时模块，可被任意层安全引入。
 */

/** 日志类型：访问日志 / 数据库日志 / 错误日志。 */
export type LogType = 'access' | 'db' | 'error';

/** 全部日志类型的只读列表（供遍历使用）。 */
export const LOG_TYPES: readonly LogType[] = ['access', 'db', 'error'];

/**
 * 访问日志记录。
 * 写入物理文件（JSON Lines）的结构，字段名沿用既有 `HttpLogRecord` 现状。
 */
export interface AccessLogRecord {
  /** 请求完成时间，ISO 8601 UTC，如 2026-09-24T01:23:45.678Z */
  time: string;
  /** HTTP 方法 */
  method: string;
  /** 请求 URL（含 query） */
  url: string;
  /** HTTP 状态码 */
  status: number;
  /** 响应耗时（ms） */
  responseTime: number;
  /** 客户端 IP */
  ip: string;
  /** User-Agent */
  userAgent: string;
  /** 查询参数（已脱敏） */
  query?: Record<string, unknown>;
  /** 请求体（已脱敏、截断） */
  reqBody?: string;
  /** 响应内容（截断；二进制仅记占位说明） */
  resBody?: string;
}

/** 数据库日志记录（Sequelize `logging` 钩子写入）。 */
export interface DbLogRecord {
  /** 执行时间，ISO 8601 UTC */
  time: string;
  /** 原始 SQL 语句 */
  sql: string;
  /** 执行耗时（ms） */
  durationMs: number;
  /** 是否为慢查询（耗时 >= config.log.slowSqlMs） */
  slow: boolean;
}

/** 错误日志记录（业务异常 / 进程级异常）。 */
export interface ErrorLogRecord {
  /** 记录时间，ISO 8601 UTC */
  time: string;
  /** 日志级别 */
  level: 'error' | 'warn';
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 请求方法（若来自 HTTP 请求） */
  method?: string;
  /** 请求 URL（若来自 HTTP 请求） */
  url?: string;
  /** 客户端 IP（若来自 HTTP 请求） */
  ip?: string;
  /** 用户 ID（若可获取） */
  userId?: number | null;
  /** HTTP 状态码（若来自 HTTP 请求） */
  statusCode?: number;
}

/** 可写入文件的日志记录联合类型。 */
export type LogRecord = AccessLogRecord | DbLogRecord | ErrorLogRecord;

/** 对外 API 契约：HTTP 访问日志条目（与前端字段对齐，保持稳定）。 */
export interface HttpLogItem {
  id: number;
  /** ISO 字符串 */
  time: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent: string;
  query?: Record<string, unknown> | null;
  reqBody?: string | null;
  resBody?: string | null;
}

/** HTTP 访问日志查询条件。 */
export interface HttpLogQuery {
  page: number;
  pageSize: number;
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
}

/** 单条归档结果。 */
export interface ArchiveResult {
  /** 日志类型 */
  type: LogType;
  /** 规范日期键 YYYY-MM-DD（补零，用于排序/比较） */
  dateKey: string;
  /** 归档状态 */
  status: 'archived' | 'skipped' | 'failed';
  /** 归档产物路径（若已生成） */
  archivePath?: string;
  /** 附加说明（跳过原因 / 失败原因） */
  message?: string;
}
