/**
 * 全局异常过滤器。
 * 模块职责：把各类异常统一转换为 `{ code, message, data: null }` 响应体。
 */
import { type ArgumentsHost, type ExceptionFilter, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { MulterError } from 'multer';
import { AppException } from './app.exception.js';
import { ERROR_CODE, ERROR_MESSAGE } from './constants.js';

/** 从校验异常载荷中提取全部提示文案。
 *
 * 兼容两种形状：
 * - Nest 12 ValidationPipe：`message` 为**扁平字符串数组** `['账号不能为空', ...]`
 * - class-validator 原生 ValidationError 树：`constraints` + `children` 递归
 */
function collectValidationMessages(exception: unknown): string[] {
  const messages: string[] = [];

  // 形状一：字符串数组
  if (Array.isArray(exception)) {
    exception.forEach((item) => {
      if (typeof item === 'string') {
        messages.push(item);
      } else {
        messages.push(...collectValidationMessages(item));
      }
    });
    return messages;
  }

  // 形状二：ValidationError 对象树
  if (exception === null || typeof exception !== 'object') {
    return messages;
  }
  const record = exception as Record<string, unknown>;
  // class-validator 的叶子错误对象：{ property, constraints: { msg: '...' } }
  const constraints = record.constraints;
  if (constraints && typeof constraints === 'object') {
    Object.values(constraints as Record<string, unknown>).forEach((msg) => {
      if (typeof msg === 'string') {
        messages.push(msg);
      }
    });
  }
  // 递归处理嵌套（children）
  const children = record.children;
  if (Array.isArray(children)) {
    children.forEach((child) => messages.push(...collectValidationMessages(child)));
  }
  return messages;
}

/** 把 Multer 上传异常转换为中文提示。 */
function resolveMulterMessage(err: MulterError): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return '文件大小超出限制';
    case 'LIMIT_FILE_COUNT':
      return '文件数量超出限制';
    case 'LIMIT_UNEXPECTED_FILE':
      return '上传字段不合法';
    default:
      return `文件上传失败: ${err.message}`;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    // 1) 业务异常：直接采用其携带的业务码与文案
    if (exception instanceof AppException) {
      const httpStatus = exception.getStatus();
      res.status(httpStatus).json({ code: exception.code, message: exception.message, data: null });
      return;
    }

    // 2) Nest 内建 HttpException（含 ValidationPipe 抛出的 400）
    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const payload = exception.getResponse();

      // ValidationPipe：{ statusCode, message: string[] | string, error }
      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        const rawMessage = record.message;

        const validationMessages = collectValidationMessages(rawMessage);
        if (validationMessages.length > 0) {
          // 去重：同一字段的多个装饰器可能产出相同文案，避免重复提示
          const unique = Array.from(new Set(validationMessages));
          res.status(httpStatus).json({
            code: ERROR_CODE.BAD_REQUEST,
            message: unique.join('; ') || ERROR_MESSAGE.BAD_REQUEST,
            data: null,
          });
          return;
        }
        if (typeof rawMessage === 'string' && rawMessage) {
          res.status(httpStatus).json({ code: httpStatus, message: rawMessage, data: null });
          return;
        }
      }
      res.status(httpStatus).json({ code: httpStatus, message: exception.message, data: null });
      return;
    }

    // 3) Multer 上传异常
    if (exception instanceof MulterError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        code: ERROR_CODE.BAD_REQUEST,
        message: resolveMulterMessage(exception),
        data: null,
      });
      return;
    }

    // 4) 未捕获异常：记录 error 日志并返回统一 500
    const message = exception instanceof Error ? exception.message : ERROR_MESSAGE.INTERNAL;
    this.logger.error(
      `[UnhandledError] ${req?.method ?? ''} ${req?.originalUrl ?? req?.url ?? ''} — ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODE.INTERNAL,
      message,
      data: null,
    });
  }
}
