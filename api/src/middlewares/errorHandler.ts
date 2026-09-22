/**
 * 错误处理中间件。
 * 模块职责：统一兜底 404 与异常，输出第 6.1 节统一响应体。
 */
import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE } from '@/constants';
import { AppError, fail } from '@/utils/response';

/**
 * 404 兜底：将未匹配路由转为 AppError 交给统一错误处理。
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`路由不存在: ${req.method} ${req.originalUrl}`));
}

/**
 * 全局错误处理。
 * @param err 抛出的异常
 * @param _req 请求对象
 * @param res 响应对象
 * @param _next 下一个中间件（未使用）
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
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

  // 未捕获异常
  console.error('[UnhandledError]', err);
  const message = err instanceof Error ? err.message : ERROR_MESSAGE.INTERNAL;
  fail(res, ERROR_CODE.INTERNAL, message, 500);
}
