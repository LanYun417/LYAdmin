/**
 * 请求参数校验中间件（基于 zod）。
 * 模块职责：对 `body` / `query` / `params` 执行 zod 校验并回写解析结果，失败返回 400。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '@/utils/response';

/** 校验 schema 集合。 */
export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * 将 zod 错误格式化为可读字符串。
 * @param error zod 校验错误
 * @returns 形如 `username: 账号格式不正确` 的描述
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * 以「可写实例属性」的方式回写解析结果（兼容 Express 5 原型上的 getter）。
 */
function assignParsed(target: Request, key: 'body' | 'query' | 'params', value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * 生成校验中间件。
 * @param schemas 待校验的 body / query / params schema
 * @returns Express 中间件
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        assignParsed(req, 'body', schemas.body.parse(req.body ?? {}));
      }
      if (schemas.query) {
        assignParsed(req, 'query', schemas.query.parse(req.query ?? {}));
      }
      if (schemas.params) {
        assignParsed(req, 'params', schemas.params.parse(req.params ?? {}));
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(AppError.badRequest(formatZodError(error)));
        return;
      }
      next(error);
    }
  };
}
