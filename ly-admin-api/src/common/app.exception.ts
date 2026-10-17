/**
 * 统一响应体与业务异常。
 * 模块职责：定义成功/失败响应结构与 `AppException` 异常类。
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODE, ERROR_MESSAGE } from './constants.js';

/** 统一响应体结构。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * 业务异常：携带业务码与 HTTP 状态码，由全局异常过滤器统一转换为响应体。
 *
 * 继承 HttpException，以便被 Nest 的全局异常过滤器按状态码捕获。
 */
export class AppException extends HttpException {
  /** 业务错误码 */
  public readonly code: number;

  /**
   * @param message 错误描述
   * @param code 业务错误码，默认 400
   * @param httpStatus HTTP 状态码，默认与业务码一致
   */
  constructor(message: string, code: number = ERROR_CODE.BAD_REQUEST, httpStatus?: number) {
    super({ code, message, data: null }, httpStatus ?? code);
    this.name = 'AppException';
    this.code = code;
    Object.setPrototypeOf(this, AppException.prototype);
  }

  /** 400 参数错误 */
  static badRequest(message: string = ERROR_MESSAGE.BAD_REQUEST): AppException {
    return new AppException(message, ERROR_CODE.BAD_REQUEST, HttpStatus.BAD_REQUEST);
  }

  /** 401 未认证 */
  static unauthorized(message: string = ERROR_MESSAGE.UNAUTHORIZED): AppException {
    return new AppException(message, ERROR_CODE.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
  }

  /** 403 无权限 */
  static forbidden(message: string = ERROR_MESSAGE.FORBIDDEN): AppException {
    return new AppException(message, ERROR_CODE.FORBIDDEN, HttpStatus.FORBIDDEN);
  }

  /** 404 资源不存在 */
  static notFound(message: string = ERROR_MESSAGE.NOT_FOUND): AppException {
    return new AppException(message, ERROR_CODE.NOT_FOUND, HttpStatus.NOT_FOUND);
  }

  /** 409 数据冲突 */
  static conflict(message: string = ERROR_MESSAGE.CONFLICT): AppException {
    return new AppException(message, ERROR_CODE.CONFLICT, HttpStatus.CONFLICT);
  }

  /** 429 请求过于频繁（如登录频率限制触发） */
  static tooManyRequests(message: string = ERROR_MESSAGE.TOO_MANY_REQUESTS): AppException {
    return new AppException(message, ERROR_CODE.TOO_MANY_REQUESTS, HttpStatus.TOO_MANY_REQUESTS);
  }
}
