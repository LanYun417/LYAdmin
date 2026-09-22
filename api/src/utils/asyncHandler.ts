/**
 * 异步处理器包装。
 * 模块职责：包裹 async 控制器/中间件，自动将 Promise 拒绝转交 Express 错误链。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** 异步处理函数签名。 */
export type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * 包装 async 处理函数，捕获异常并交给 `next`。
 * @param fn 异步处理函数
 * @returns Express RequestHandler
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
