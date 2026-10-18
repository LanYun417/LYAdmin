/**
 * 操作日志拦截器。
 * 模块职责：拦截声明了 `@OperationLog` 的写操作端点，在响应结束时异步落库。
 *
 * 时序说明：拦截器在 handler 执行**前**记录起始时间与请求体，
 * 在 `res.on('finish')` 回调中读取最终 statusCode 并异步写库（fire-and-forget）。
 * 此时鉴权守卫已执行完成，`req.user` 可安全读取。
 */
import { type CallHandler, type ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { OperationLogService } from './operation-log.service.js';
import { getOperationMeta, inferAction, type OperationMeta } from './operation-log.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { IpRegionService } from '../ip/ip-region.service.js';

/** 读取客户端 IP（受 trust proxy 设置影响）。 */
export function getClientIp(req: Request): string {
  const ip = req.ip;
  if (typeof ip === 'string' && ip.length > 0) {
    return ip;
  }
  return req.socket?.remoteAddress ?? '';
}

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly operationLogService: OperationLogService,
    private readonly ipRegion: IpRegionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 仅处理 HTTP 上下文
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const handler = context.getHandler();
    const meta = getOperationMeta(handler as (...args: never[]) => unknown);
    // 未声明 @OperationLog 的端点不记日志（白名单制）
    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    const startAt = Date.now();
    let errorMessage: string | null = null;

    // 劫持 json() 以捕获失败响应中的 message
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (body !== null && typeof body === 'object' && 'message' in (body as Record<string, unknown>)) {
        const message = (body as Record<string, unknown>).message;
        errorMessage = typeof message === 'string' ? message : '';
      }
      return originalJson(body);
    };

    res.on('finish', () => {
      const statusCode = res.statusCode;
      void this.recordOperationLog(req, meta, statusCode, errorMessage, Date.now() - startAt);
    });

    return next.handle();
  }

  /** 解析 IP 归属地后异步写操作日志（fire-and-forget；解析失败不影响日志写入）。 */
  private async recordOperationLog(
    req: AuthenticatedRequest,
    meta: OperationMeta,
    statusCode: number,
    errorMessage: string | null,
    duration: number,
  ): Promise<void> {
    const ip = getClientIp(req) || null;
    const location = (await this.ipRegion.locate(ip)) || null;
    await this.operationLogService.createOperationLog({
      userId: req.user?.userId ?? null,
      username: req.user?.username ?? null,
      module: meta.module,
      action: meta.action && meta.action.length > 0 ? meta.action : inferAction(req.method),
      method: req.method.toUpperCase(),
      url: req.originalUrl ?? req.url ?? '',
      params: OperationLogService.serializeParams(req.body),
      duration,
      result: statusCode < 400 ? 1 : 0,
      errorMessage: statusCode < 400 ? null : errorMessage || `HTTP ${statusCode}`,
      ip,
      location,
    });
  }
}
