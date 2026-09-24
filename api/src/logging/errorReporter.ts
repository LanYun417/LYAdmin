/**
 * 错误上报器。
 * 模块职责：把业务异常（errorHandler 调用）与进程级异常
 * （unhandledRejection / uncaughtException）统一构造为 `ErrorLogRecord`，
 * 写入 error 日志文件（`logs/error/YYYY-M-D.log`，JSON Lines）。
 *
 * 约定（见 docs/system_design.md §3.7 / §8）：
 * - 仅写文件，**绝不写数据库**，避免递归。
 * - 任何写入失败都内部吞掉并 console.error，绝不向调用方抛出、绝不引发二次崩溃。
 * - 支持传入 Express `req`，自动提取 method/url/ip/userId。
 */
import type { Request } from 'express';
import { writeLog } from './logManager';
import type { ErrorLogRecord } from './types';

/** 错误上报上下文。 */
export interface ErrorContext {
  /** Express 请求对象；提供后自动提取 method/url/ip/userId（显式字段优先） */
  req?: Request;
  /** 请求方法（显式指定，优先级高于 req） */
  method?: string;
  /** 请求 URL（显式指定，优先级高于 req） */
  url?: string;
  /** 客户端 IP（显式指定，优先级高于 req） */
  ip?: string;
  /** 用户 ID（显式指定，优先级高于 req；显式传 null 表示“无用户”） */
  userId?: number | null;
  /** HTTP 状态码（显式指定，优先级高于 req） */
  statusCode?: number;
  /** 日志级别，默认 'error' */
  level?: 'error' | 'warn';
}

/**
 * 解析错误消息为字符串。
 * @param err 任意错误值
 * @returns 可读的错误消息
 */
function resolveMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name || 'Error';
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    const serialized = JSON.stringify(err);
    return serialized === undefined ? String(err) : serialized;
  } catch {
    return String(err);
  }
}

/**
 * 解析错误堆栈（仅 Error 实例有堆栈）。
 * @param err 任意错误值
 * @returns 堆栈字符串，无法获取时为 undefined
 */
function resolveStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

/**
 * 从 Express 请求中提取客户端 IP（只信任 `req.ip`，不再直读 `X-Forwarded-For`）。
 * 说明：此处内联实现，避免与并行维护的 `utils/logger.ts` 产生耦合/循环依赖；
 * `req.ip` 已由 Express 依据 trust proxy 配置决定是否解析 XFF，故与 getClientIp 语义一致，
 * 不存在第二处绕过 trust proxy 实现伪造 IP。
 * @param req Express 请求对象
 * @returns 客户端 IP 字符串
 */
function resolveClientIp(req: Request): string {
  const ip = req.ip;
  if (typeof ip === 'string' && ip.length > 0) {
    return ip;
  }
  return req.socket?.remoteAddress ?? '';
}

/**
 * 根据错误值与上下文构造一条错误日志记录。
 * @param err 任意错误值
 * @param ctx 上报上下文
 * @returns 规范化后的错误日志记录
 */
function buildRecord(err: unknown, ctx: ErrorContext): ErrorLogRecord {
  const req = ctx.req;
  const userId = ctx.userId !== undefined ? ctx.userId : (req?.user?.userId ?? null);

  return {
    time: new Date().toISOString(),
    level: ctx.level ?? 'error',
    message: resolveMessage(err),
    stack: resolveStack(err),
    method: ctx.method ?? req?.method,
    url: ctx.url ?? req?.originalUrl ?? req?.url,
    ip: ctx.ip ?? (req ? resolveClientIp(req) : undefined),
    userId,
    statusCode: ctx.statusCode,
  };
}

/**
 * 安全写入错误日志：任何异常仅 console.error，绝不外抛。
 * @param record 错误日志记录
 */
function safeWrite(record: ErrorLogRecord): void {
  try {
    writeLog('error', record);
  } catch (error) {
    console.error('[ErrorReporter] 写入错误日志失败:', error);
  }
}

/**
 * 业务异常上报（由全局 errorHandler 调用）。
 * 内部吞异常，错误日志写失败不会影响业务响应。
 * @param err 任意错误值
 * @param ctx 上报上下文（可传 Express `req` 与 `statusCode`）
 */
export function reportError(err: unknown, ctx: ErrorContext = {}): void {
  safeWrite(buildRecord(err, ctx));
}

/**
 * 进程级异常上报（由 unhandledRejection / uncaughtException 处理器调用）。
 * 无请求上下文，消息前缀标注异常类型便于排查。
 * @param kind 进程异常类型
 * @param err 任意错误值
 */
export function reportProcessError(kind: 'unhandledRejection' | 'uncaughtException', err: unknown): void {
  const base = buildRecord(err, {});
  safeWrite({ ...base, message: `[${kind}] ${base.message}` });
}
