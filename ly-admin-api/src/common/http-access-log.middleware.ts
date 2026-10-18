/**
 * HTTP 访问日志中间件与 User-Agent 解析。
 * 模块职责：记录每个 API 请求的时间/方法/URL/状态码/耗时/操作者快照，
 * 同时写入文件与 sys_http_log 表（页面查询用）。
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpLogQueueService } from './http-log-queue.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { FileLoggerService } from './file-logger.service.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { getClientIp } from './operation-log.interceptor.js';
import { IpRegionService } from './ip-region.service.js';

/** 单条日志体上限（2KB），超出截断。 */
const BODY_LIMIT = 2048;

/** 敏感字段正则（比操作日志的精确匹配更宽，覆盖 token/secret 等）。 */
const SENSITIVE_PATTERN = /password|pwd|pass|token|secret|authorization|credential/i;

/** 递归脱敏（正则匹配键名，命中则替换为 `******`）。 */
function mask(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return '[depth-limit]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => mask(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_PATTERN.test(key) ? '******' : mask(item, depth + 1);
    }
    return result;
  }
  return value;
}

/** 安全序列化并截断。 */
function safeSerialize(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    const text = JSON.stringify(mask(value));
    return text === undefined ? null : text.slice(0, BODY_LIMIT);
  } catch {
    return null;
  }
}

/** 从 User-Agent 解析浏览器名。 */
export function parseBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('curl')) return 'curl';
  return 'Unknown';
}

/** 从 User-Agent 解析操作系统。 */
export function parseOs(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Unknown';
}

/** 截断并序列化响应体（二进制以占位符替代）。 */
function serializeResponse(body: unknown): string | null {
  if (body === undefined || body === null) {
    return null;
  }
  if (Buffer.isBuffer(body)) {
    return `[binary ${body.length} bytes]`;
  }
  if (typeof body === 'string') {
    return body.slice(0, BODY_LIMIT);
  }
  return safeSerialize(body);
}

@Injectable()
export class HttpAccessLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly fileLogger: FileLoggerService,
    private readonly httpLogs: HttpLogQueueService,
    private readonly ipRegion: IpRegionService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // 静态资源与健康检查不记访问日志（避免噪音）
    const originalUrl = req.originalUrl ?? req.url ?? '';
    const pathOnly = originalUrl.split('?')[0];
    if (pathOnly.startsWith('/static') || pathOnly === '/api' || pathOnly.startsWith('/api-docs')) {
      next();
      return;
    }

    const startAt = Date.now();
    let responseBody: unknown;

    // 捕获响应体（用于日志留痕）
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      // 成功 GET 不保留响应体：列表响应体积大，序列化 + 递归脱敏纯属额外开销；
      // 失败响应与写操作仍保留，便于审计与排障。
      if (req.method !== 'GET' || res.statusCode >= 400) {
        responseBody = body;
      }
      return originalJson(body);
    };

    res.on('finish', () => {
      const duration = Date.now() - startAt;
      const userAgent = String(req.headers['user-agent'] ?? '');
      const ip = getClientIp(req);
      const authReq = req as AuthenticatedRequest;
      const url = originalUrl.slice(0, 1024);

      const record = {
        time: new Date(),
        method: req.method.toUpperCase(),
        url,
        statusCode: res.statusCode,
        duration,
        ip: ip || null,
        userAgent: userAgent.slice(0, 500) || null,
        userId: authReq.user?.userId ?? 0,
        username: authReq.user?.username ?? null,
        deptId: authReq.user?.deptId ?? 0,
        deptName: authReq.user?.deptName ?? null,
        query: mask(req.query) as Prisma.InputJsonValue,
        reqBody: safeSerialize(req.body),
        resBody: serializeResponse(responseBody),
      };

      // 归属地解析为异步：先解析再落库，解析失败不影响访问日志写入
      void this.ipRegion.locate(ip).then((location) => {
        // 1) 写文件（留痕）
        this.fileLogger.access({
          method: record.method,
          url: record.url,
          statusCode: record.statusCode,
          duration: record.duration,
          ip: record.ip,
          username: record.username,
        });

        // 2) 入队批量落库（页面查询用），不阻塞响应
        this.httpLogs.enqueue({
          time: record.time,
          method: record.method,
          url: record.url,
          statusCode: record.statusCode,
          duration: record.duration,
          ip: record.ip,
          location: location || null,
          userAgent: record.userAgent,
          userId: BigInt(record.userId),
          username: record.username,
          deptId: BigInt(record.deptId),
          deptName: record.deptName,
          query: record.query,
          reqBody: record.reqBody,
          resBody: record.resBody,
        });
      });
    });

    next();
  }

  /** 供日志控制器复用：解析并返回展示用的浏览器/系统。 */
  static decorateUserAgent(userAgent: string | null): { browser: string; os: string } {
    const ua = userAgent ?? '';
    return { browser: parseBrowser(ua), os: parseOs(ua) };
  }
}
