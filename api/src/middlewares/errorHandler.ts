/**
 * 错误处理中间件。
 * 模块职责：统一兜底 404 与异常，输出第 6.1 节统一响应体。
 */
import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE } from '@/constants';
import { reportError } from '@/logging/errorReporter';
import { AppError, fail } from '@/utils/response';

/**
 * 404 兜底：将未匹配路由转为 AppError 交给统一错误处理。
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`路由不存在: ${req.method} ${req.originalUrl}`));
}

/**
 * 全局错误处理。
 * 仅对 5xx 业务异常与未捕获异常写入 error 日志（`logs/error/`）；
 * 4xx 为预期内的业务错误，不记录以免噪音。
 * 保留既有 `console.error` 行为与统一响应体格式不变。
 * @param err 抛出的异常
 * @param req 请求对象（用于错误日志上下文）
 * @param res 响应对象
 * @param _next 下一个中间件（未使用）
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    // 仅 5xx 业务异常写错误日志；4xx 属预期业务错误，不记录
    if (err.httpStatus >= 500) {
      reportError(err, { req, statusCode: err.httpStatus });
    }
    fail(res, err.code, err.message, err.httpStatus);
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => issue.message).join('; ');
    fail(res, ERROR_CODE.BAD_REQUEST, message || ERROR_MESSAGE.BAD_REQUEST, 400);
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? '文件大小超出限制'
        : err.code === 'LIMIT_FILE_COUNT'
          ? '文件数量超出限制'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? '上传字段不合法'
            : `文件上传失败: ${err.message}`;
    fail(res, ERROR_CODE.BAD_REQUEST, message, 400);
    return;
  }

  // 未捕获异常：保留既有 console.error，并写入错误日志（5xx）
  console.error('[UnhandledError]', err);
  reportError(err, { req, statusCode: ERROR_CODE.INTERNAL });
  const message = err instanceof Error ? err.message : ERROR_MESSAGE.INTERNAL;
  fail(res, ERROR_CODE.INTERNAL, message, 500);
}
