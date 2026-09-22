/**
 * 统一响应体与业务异常。
 * 模块职责：定义成功/失败响应结构、`AppError` 异常类，供控制器与中间件复用。
 */
import type { Response } from 'express';
import { ERROR_CODE, ERROR_MESSAGE } from '@/constants';

/** 统一响应体结构（第 6.1 节）。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * 业务异常：携带业务码与 HTTP 状态码，由 errorHandler 统一转换。
 */
export class AppError extends Error {
  /** 业务错误码 */
  public readonly code: number;
  /** HTTP 状态码 */
  public readonly httpStatus: number;

  /**
   * @param message 错误描述
   * @param code 业务错误码，默认 400
   * @param httpStatus HTTP 状态码，默认与业务码一致
   */
  constructor(message: string, code: number = ERROR_CODE.BAD_REQUEST, httpStatus?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus ?? code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /** 401 未认证 */
  static unauthorized(message: string = ERROR_MESSAGE.UNAUTHORIZED): AppError {
    return new AppError(message, ERROR_CODE.UNAUTHORIZED, 401);
  }

  /** 403 无权限 */
  static forbidden(message: string = ERROR_MESSAGE.FORBIDDEN): AppError {
    return new AppError(message, ERROR_CODE.FORBIDDEN, 403);
  }

  /** 404 资源不存在 */
  static notFound(message: string = ERROR_MESSAGE.NOT_FOUND): AppError {
    return new AppError(message, ERROR_CODE.NOT_FOUND, 404);
  }

  /** 409 数据冲突 */
  static conflict(message: string = ERROR_MESSAGE.CONFLICT): AppError {
    return new AppError(message, ERROR_CODE.CONFLICT, 409);
  }

  /** 400 参数错误 */
  static badRequest(message: string = ERROR_MESSAGE.BAD_REQUEST): AppError {
    return new AppError(message, ERROR_CODE.BAD_REQUEST, 400);
  }
}

/**
 * 发送成功响应。
 * @param res Express 响应对象
 * @param data 业务数据
 * @param message 提示信息，默认 `success`
 * @returns Express Response
 */
export function ok<T>(res: Response, data: T, message: string = ERROR_MESSAGE.SUCCESS): Response {
  const body: ApiResponse<T> = { code: ERROR_CODE.SUCCESS, message, data };
  return res.status(200).json(body);
}

/**
 * 发送失败响应。
 * @param res Express 响应对象
 * @param code 业务错误码
 * @param message 错误描述
 * @param httpStatus HTTP 状态码，默认与业务码一致
 * @returns Express Response
 */
export function fail(res: Response, code: number, message: string, httpStatus?: number): Response {
  const body: ApiResponse<null> = { code, message, data: null };
  return res.status(httpStatus ?? code).json(body);
}
