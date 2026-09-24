/**
 * 日志工具。
 * 模块职责：提供 HTTP 访问日志中间件（请求参数/请求体/响应内容采集、脱敏、截断）与客户端 IP 解析。
 * 访问日志采用「双写」：① 物理文件（按天，JSON Lines，留痕）② `sys_http_log` 表（供页面查询）。
 * 物理文件与数据库各自独立失败隔离，任一步骤异常均不影响业务响应。
 */
import type { Request, RequestHandler, Response } from 'express';
import { writeLog } from '@/logging/logManager';
import { appendHttpLog } from '@/logging/httpLogStore';
import type { AccessLogRecord } from '@/logging/types';

/**
 * 解析客户端真实 IP（优先取代理头 `x-forwarded-for`）。
 * @param req Express 请求对象
 * @returns 客户端 IP 字符串
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip ?? req.socket.remoteAddress ?? '';
}

/** 请求/响应内容捕获与序列化上限（字节） */
const MAX_BODY_LENGTH = 2048;

/** 敏感字段名（命中后值替换为 ******） */
const SENSITIVE_KEY_RE = /password|pwd|pass|token|secret|authorization|credential/i;

/** 递归脱敏对象中的敏感字段。 */
function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_RE.test(key) ? '******' : redactSensitive(val);
    }
    return result as unknown as T;
  }
  return value;
}

/** 超长截断。 */
function truncateText(text: string): string {
  return text.length > MAX_BODY_LENGTH
    ? `${text.slice(0, MAX_BODY_LENGTH)}
…（内容过长，已截断）`
    : text;
}

/**
 * 序列化请求体：对象先脱敏再紧凑序列化；纯字符串尝试按 JSON 解析脱敏。
 * @param value 请求体（express.json 解析结果或原始字符串）
 */
function serializeBody(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  let text: string;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      text = JSON.stringify(redactSensitive(JSON.parse(trimmed)));
    } catch {
      text = value;
    }
  } else {
    try {
      text = JSON.stringify(redactSensitive(value));
    } catch {
      text = String(value);
    }
  }
  return truncateText(text);
}

/**
 * 拦截 res.write / res.end 收集响应内容（最多 MAX_BODY_LENGTH 字节，超出只计数不再入内存）。
 * @returns 读取函数：{ text, totalBytes }
 */
function captureResponseBody(res: Response): () => { text: string; totalBytes: number } {
  const chunks: Buffer[] = [];
  let capturedBytes = 0;
  let totalBytes = 0;

  const collect = (chunk: unknown): void => {
    if (!chunk) {
      return;
    }
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buf.length;
    if (capturedBytes >= MAX_BODY_LENGTH) {
      return;
    }
    const remain = MAX_BODY_LENGTH - capturedBytes;
    const slice = buf.length > remain ? buf.subarray(0, remain) : buf;
    chunks.push(slice);
    capturedBytes += slice.length;
  };

  type WriteArgs = Parameters<Response['write']>;
  type EndArgs = Parameters<Response['end']>;
  const originalWrite = res.write.bind(res) as (...args: WriteArgs) => boolean;
  const originalEnd = res.end.bind(res) as (...args: EndArgs) => Response;

  res.write = ((...args: WriteArgs) => {
    collect(args[0]);
    return originalWrite(...args);
  }) as typeof res.write;

  res.end = ((...args: EndArgs) => {
    collect(args[0]);
    return originalEnd(...args);
  }) as typeof res.end;

  return () => ({ text: Buffer.concat(chunks).toString('utf-8'), totalBytes });
}

/**
 * HTTP 访问日志中间件：
 * 拦截响应收集内容，finish 时组装 AccessLogRecord，
 * ① 以 JSON Lines 追加写入按天物理文件（`logs/access/YYYY-M-D.log`）；
 * ② fire-and-forget 写入 `sys_http_log` 表（不阻塞响应）。
 * 任一步骤失败仅 console.error，绝不影响业务响应。
 */
export function httpAccessLogger(): RequestHandler {
  return (req, res, next) => {
    // 只记录后端 API 请求：静态资源（/uploads）等其他请求一律不记录。
    // 注意：必须用 originalUrl（挂载前完整路径）——req.path 是随 req.url
    // 变化的惰性属性，finish 时已被路由剥掉挂载前缀（如 /stats）。
    const requestPath = (req.originalUrl || req.url || '').split('?')[0];
    if (!requestPath.startsWith('/api/')) {
      next();
      return;
    }

    const startAt = process.hrtime.bigint();
    const getResponseBody = captureResponseBody(res);

    res.on('finish', () => {
      try {
        const contentType = String(res.getHeader('content-type') ?? '');
        const { text, totalBytes } = getResponseBody();

        // 获取日志数据的接口（/api/logs/*）：响应本身就是日志列表，
        // 再记录会造成递归噪音，故不记录其响应内容
        const skipResBody = requestPath.startsWith('/api/logs');

        let resBody: string | undefined;
        if (!skipResBody && totalBytes > 0) {
          resBody = /json|text|html|xml/i.test(contentType)
            ? truncateText(text)
            : `（二进制响应，共 ${totalBytes} 字节）`;
        }

        const hasQuery = Object.keys(req.query).length > 0;
        const record: AccessLogRecord = {
          time: new Date().toISOString(),
          method: req.method,
          url: req.originalUrl || req.url || '',
          status: res.statusCode,
          responseTime: Number((process.hrtime.bigint() - startAt) / 1000000n),
          ip: getClientIp(req),
          userAgent: req.get('user-agent') ?? '',
          query: hasQuery ? (redactSensitive(req.query) as Record<string, unknown>) : undefined,
          reqBody: serializeBody(req.body),
          resBody,
        };

        // ① 物理文件（按天，JSON Lines）
        writeLog('access', record);
        // ② 数据库（fire-and-forget，内部已吞异常）
        void appendHttpLog(record);
      } catch (error) {
        // 日志记录失败不影响业务响应
        console.error('[HttpAccessLogger] 写入访问日志失败:', error);
      }
    });

    next();
  };
}
