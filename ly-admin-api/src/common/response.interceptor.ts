/**
 * 全局响应拦截器。
 * 模块职责：把控制器返回的裸数据包装为统一响应体 `{ code: 200, message, data }`。
 *
 * 约定：
 * - 控制器直接返回业务数据本体，message 默认 `success`；
 * - 需要自定义提示语时，控制器可返回 `{ __raw: true, data, message }` 标记对象。
 * - 二进制响应（文件流/图片缩放等）通过 `@RawResponse()` 标记跳过包装。
 *
 * 实现要点（勿改回「手动 res.json」写法）：
 * 本拦截器**只负责把返回值改写成响应体**，由 Nest 的适配器负责写出。若在这里直接调用
 * `res.status(200).json(...)` 再返回 payload，框架随后会重复写出响应，每个成功请求都抛
 * `ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent`。
 * HTTP 状态码统一为 200 的职责由 OkExpressAdapter.reply 承担（见该文件）。
 */
import { type CallHandler, type ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Readable } from 'node:stream';
import { map, type Observable } from 'rxjs';
import { ERROR_CODE, ERROR_MESSAGE } from './constants.js';

/** 控制器方法装饰器：标记该响应为「原样输出」，跳过统一响应体包装。 */
export const RAW_RESPONSE_KEY = 'ly:rawResponse';
export const RawResponse = (): MethodDecorator & ClassDecorator => SetMetadata(RAW_RESPONSE_KEY, true);

/** 控制器返回的带提示语包装结构。 */
export interface ResponseEnvelope<T> {
  /** 内部标记：表明这是包装信封而非业务数据 */
  __raw: true;
  data: T;
  message?: string;
}

/** 判断返回值是否为包装信封。 */
export function isResponseEnvelope(value: unknown): value is ResponseEnvelope<unknown> {
  return (
    typeof value === 'object' && value !== null && '__raw' in value && (value as { __raw?: unknown }).__raw === true
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    // 原样输出（文件流、CSV、图片等）：直接透传，不做任何包装
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload: unknown) => {
        // 文件流等原始 Buffer/Stream 不参与包装
        if (Buffer.isBuffer(payload) || payload instanceof Readable) {
          return payload;
        }

        // 已是完整信封（如控制器用 respond() 显式构造）：仅补齐缺失字段
        if (isResponseEnvelope(payload)) {
          return {
            code: ERROR_CODE.SUCCESS,
            message: payload.message ?? ERROR_MESSAGE.SUCCESS,
            data: payload.data ?? null,
          };
        }

        return { code: ERROR_CODE.SUCCESS, message: ERROR_MESSAGE.SUCCESS, data: payload ?? null };
      }),
    );
  }
}
