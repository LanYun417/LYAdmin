/**
 * 请求 traceId 贯穿（AsyncLocalStorage）。
 *
 * 为什么用 ALS 而不是把 req 透传进业务层：写日志的点分散在中间件、拦截器、
 * 异常过滤器与服务层，把 req 一路传参会污染所有签名；ALS 让「当前请求」变成一个
 * 随处可读的上下文（与操作日志的 runWithSnapshot 同一模式）。
 *
 * 生成时机：中间件在请求入口解析（客户端/上游可带 `X-Request-Id`），
 * 之后 HTTP 日志、操作日志、错误日志都从同一上下文取同一串 id；
 * 响应头原样回带，前端报错时用户可直接反馈这串 id 定位请求。
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';

/** 入站 / 出站共用的请求标识头（全小写：Node 归一化请求头后的键名）。 */
export const TRACE_HEADER = 'x-request-id';

/** 出站响应头名（保持与入站一致，网关/浏览器都按 `X-Request-Id` 显示）。 */
export const TRACE_RESPONSE_HEADER = 'X-Request-Id';

/** 可接受的客户端 traceId 最大长度（防滥用头塞入超长串）。 */
const MAX_INBOUND_LENGTH = 64;

/** 可接受的字符集：十六进制 / 字母数字 / 连字符（uuid、w3c traceparent 片段均兼容）。 */
const TRACE_PATTERN = /^[A-Za-z0-9-]+$/;

const storage = new AsyncLocalStorage<string>();

/**
 * 生成 traceId：16 位十六进制（8 字节加密随机，碰撞概率可忽略，比 uuid 短一半，
 * 日志列（VarChar 64）与响应头都更易读）。
 */
export function generateTraceId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * 解析入站 traceId：客户端/上游带了合规的 `X-Request-Id` 就沿用（便于网关侧串联），
 * 否则新生成。非法头（超长 / 含奇怪字符）一律丢弃重生成——客户端输入不直接进日志列。
 * @param req Express 请求
 */
export function resolveTraceId(req: Request): string {
  const inbound = req.headers[TRACE_HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  if (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    candidate.length <= MAX_INBOUND_LENGTH &&
    TRACE_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  return generateTraceId();
}

/**
 * 在指定 traceId 上下文中执行（由 TraceIdMiddleware 在请求入口调用）。
 *
 * 注意：`res.on('finish')` / 队列异步回调等**脱离** async 上下文的位置 `getTraceId()` 取不到值，
 * 那些位置必须显式把 id 传过去（或持有引用），不能依赖 ALS。
 * @param traceId 请求标识
 * @param callback 后续处理
 */
export function runWithTrace<T>(traceId: string, callback: () => T): T {
  return storage.run(traceId, callback);
}

/** 取当前请求的 traceId（无上下文时返回 undefined，调用方按 null 落库）。 */
export function getTraceId(): string | undefined {
  return storage.getStore();
}
