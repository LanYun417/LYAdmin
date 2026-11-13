/**
 * traceId 中间件：请求入口建立 traceId 上下文，并在响应头回带。
 *
 * 挂载位置：必须在所有中间件**之前**（app.setup 里第一个 app.use），
 * 保证后续任何环节（限流、访问日志、异常过滤器）都能从上下文拿到同一串 id。
 * 与 securityHeaders() 同为函数式中间件（express 原生 app.use 友好）。
 */
import type { NextFunction, Request, Response } from 'express';
import { resolveTraceId, runWithTrace, TRACE_RESPONSE_HEADER } from './trace-id.js';

/** traceId 中间件：解析 / 生成 traceId → 响应头回带 → 建立上下文后放行。 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = resolveTraceId(req);
  // 响应头回带：前端 axios 拦截器可读取，用户反馈报错时直接带上这串 id
  res.setHeader(TRACE_RESPONSE_HEADER, traceId);
  runWithTrace(traceId, () => next());
}
