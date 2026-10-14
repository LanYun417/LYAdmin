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
 * 解析客户端真实 IP。
 *
 * **只信任 Express 的 `req.ip`**，绝不手工读取 `X-Forwarded-For` 头。原因：
 * 当 `config.trustProxy > 0`（即 app.ts 执行 `app.set('trust proxy', n)`）时，Express 会
 * 依据代理跳数自行解析 XFF 并写入 `req.ip`；默认配置（trustProxy = 0）下 `req.ip` 即真实
 * socket 地址。若在此直接读 XFF 头，会绕过 trust proxy 配置——攻击者只需伪造一个 XFF 头，
 * 就能伪造 IP、绕过登录频率限制（A3），并污染登录/操作/HTTP 审计日志（A2 的安全前提）。
 * @param req Express 请求对象
 * @returns 客户端 IP 字符串
 */
export function getClientIp(req: Request): string {
  const ip = req.ip;
  if (typeof ip === 'string' && ip.length > 0) {
    return ip;
  }
  return req.socket?.remoteAddress ?? '';
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
 * 对疑似 JSON 的响应文本做脱敏后重新序列化。
 *
 * 请求体 / query 已通过 {@link redactSensitive} 脱敏，但响应体（resBody）此前未脱敏。
 * 登录（`/api/auth/login`）、刷新（`/api/auth/refresh`）等接口会在响应里回传
 * `accessToken` / `refreshToken`，若不处理会随访问日志落盘（物理文件 + `sys_http_log` 表），
 * 造成 JWT 凭据泄露。此处对齐请求体逻辑，对响应中的敏感键值同样掩码。
 *
 * 非 JSON 文本（或已被截断导致无法解析的 JSON）原样返回——无法可靠定位凭据，且
 * 截断后本就只剩片段，泄露面可控。
 */
function redactJsonText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return text;
  }
  try {
    return JSON.stringify(redactSensitive(JSON.parse(trimmed)));
  } catch {
    return text;
  }
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
    // 只记录后端 API 请求：静态资源（/static）等其他请求一律不记录。
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
            ? truncateText(redactJsonText(text))
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
          // 操作者快照：finish 时鉴权中间件早已执行完毕，req.user 可用（未登录请求为 undefined）。
          // 取值来自鉴权上下文，无需额外查库。
          userId: req.user?.userId ?? 0,
          username: req.user?.username ?? null,
          deptId: req.user?.deptId ?? 0,
          deptName: req.user?.deptName ?? null,
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
