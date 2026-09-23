/**
 * 日志工具。
 * 模块职责：提供 morgan 访问日志输出流、JSON Lines 落盘格式，以及 HTTP 日志文件读取（供 `/api/logs/http` 使用）。
 */
import fs from 'fs';
import path from 'path';
import type { Request, RequestHandler, Response } from 'express';
import { config } from '@/config';

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

/** 访问日志文件绝对路径。 */
export const ACCESS_LOG_FILE = path.join(config.logDir, 'access.log');

// 确保日志目录存在
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

/** 访问日志写入流（追加模式；清空日志时会重建）。 */
let accessLogStream = fs.createWriteStream(ACCESS_LOG_FILE, { flags: 'a' });

/**
 * 清空访问日志文件。
 * 先关闭写入流（等待句柄释放，避免 Windows 下文件占用），
 * 再截断文件并重建流，保证后续日志继续正常写入。
 */
export function clearAccessLog(): Promise<void> {
  return new Promise((resolve, reject) => {
    accessLogStream.end(() => {
      try {
        fs.writeFileSync(ACCESS_LOG_FILE, '');
        accessLogStream = fs.createWriteStream(ACCESS_LOG_FILE, { flags: 'a' });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/** 一条访问日志记录。 */
export interface HttpLogRecord {
  time: string;
  method: string;
  url: string;
  status: number;
  responseTime: number;
  ip: string;
  userAgent: string;
  /** 请求查询参数（已脱敏） */
  query?: Record<string, unknown>;
  /** 请求体（JSON 序列化、脱敏、超长截断） */
  reqBody?: string;
  /** 响应内容（截断；二进制仅记占位说明） */
  resBody?: string;
}

/** 访问日志查询条件。 */
export interface HttpLogQuery {
  page: number;
  pageSize: number;
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
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
 * HTTP 访问日志中间件（替代 morgan 落盘）：
 * 拦截响应收集内容，finish 时以 JSON Lines 追加写入访问日志文件，
 * 记录请求查询参数、请求体（脱敏）与响应内容（截断）。
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
        const record: HttpLogRecord = {
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
        accessLogStream.write(`${JSON.stringify(record)}
`);
      } catch (error) {
        // 日志记录失败不影响业务响应
        console.error('[HttpAccessLogger] 写入访问日志失败:', error);
      }
    });

    next();
  };
}

export function readHttpLogs(query: HttpLogQuery): { list: HttpLogRecord[]; total: number } {
  if (!fs.existsSync(ACCESS_LOG_FILE)) {
    return { list: [], total: 0 };
  }

  const content = fs.readFileSync(ACCESS_LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  const records: HttpLogRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as HttpLogRecord;
      records.push(parsed);
    } catch {
      // 忽略无法解析的历史行
    }
  }

  const filtered = records.filter((record) => {
    // 兼容历史数据：只展示后端 API 请求（中间件层现已仅记录 /api/*）
    if (!record.url.startsWith('/api')) {
      return false;
    }
    if (query.method && record.method.toUpperCase() !== query.method.toUpperCase()) {
      return false;
    }
    if (query.statusCode && record.status !== query.statusCode) {
      return false;
    }
    if (query.startTime && record.time < query.startTime) {
      return false;
    }
    if (query.endTime && record.time > query.endTime) {
      return false;
    }
    return true;
  });

  // 倒序：最新在前
  filtered.reverse();

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const list = filtered.slice(start, start + query.pageSize);

  return { list, total };
}
