/**
 * 环境配置中心。
 * 统一读取 `api/.env`，导出强类型配置对象，供全局引用。
 * 模块职责：唯一的环境变量读取入口，禁止在其它模块直接读取 process.env。
 */
import dotenv from 'dotenv';
import path from 'path';

// api 根目录（config 位于 api/src/config，向上两级即 api/）
const ROOT_DIR = path.resolve(__dirname, '../../');

dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });

/** 日志根目录（绝对路径），供 logDir 与归档目录复用。 */
const LOG_DIR = path.resolve(ROOT_DIR, process.env.LOG_DIR ?? 'logs');

/** 将字符串布尔值安全转换为 boolean。 */
function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

/** 将字符串数字安全转换为 number。 */
function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 解析防盗链 Referer 白名单：接受逗号分隔的 origin（`http://a.com`）或裸 host（`a.com`），
 * 统一归一为小写的 `host`（含端口）。未配置时返回空数组（仅放行「无 Referer」与「同源」）。
 * @param value 环境变量原始值
 */
function parseRefererHosts(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).host.toLowerCase();
      } catch {
        return item.toLowerCase();
      }
    });
}

/** 保留天数合理性上界提示阈值（超过仅告警，不拒绝）。 */
const RETENTION_DAYS_MAX_HINT = 3650;

/**
 * 解析「日志保留天数」：必须为**正整数**。
 *
 * 安全背景（下界保护）：`retention = 0` 会让 `cutoff = now - 0 = now` → 删除**整张日志表**；
 * 一个环境变量的笔误即可造成数据事故。因此对 `≤ 0` / 非整数 / 非数字 / 空串一律**拒绝该值、
 * 回退到默认值**并打印明确告警。同时对上界做合理性提示（> {@link RETENTION_DAYS_MAX_HINT} 天仅告警）。
 * @param name 环境变量名
 * @param fallback 默认保留天数（正整数）
 * @returns 合法的保留天数（非法时返回 fallback）
 */
function parseRetentionDays(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[LogRetention] ${name}=${raw} 非法（保留天数须为正整数），已回退默认 ${fallback} 天`);
    return fallback;
  }
  if (parsed > RETENTION_DAYS_MAX_HINT) {
    console.warn(
      `[LogRetention] ${name}=${parsed} 超出常见合理范围（> ${RETENTION_DAYS_MAX_HINT} 天），请确认是否有意为之`,
    );
  }
  return parsed;
}

/** 生成 32 字节随机密钥的命令（用于必填项报错信息与 .env.example 说明）。 */
const SECRET_GEN_HINT = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;

/**
 * 读取必填的环境变量；缺失或为空时抛出清晰错误并终止启动（fail-fast）。
 *
 * 安全背景：JWT 密钥此前带有硬编码默认值，且 api/.env 实际就使用了该默认值，
 * 等于把签名密钥公开给全网，任何人均可伪造 Token。此处改为必填，绝不允许回退默认值。
 * 由于 config 对象在模块顶层求值，抛错发生在进程启动早期（符合 fail-fast 预期）。
 * @param name 环境变量名
 * @param hint 附加提示（如生成命令），可为空
 * @returns 非空的环境变量值
 */
function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    const lines = [`[Config] 缺少必填环境变量 ${name}，服务拒绝启动。`];
    if (hint) {
      lines.push(`  提示：${hint}`);
    }
    throw new Error(lines.join('\n'));
  }
  return value;
}

/** 全局配置对象。 */
export const config = {
  /** 运行环境 */
  env: process.env.NODE_ENV ?? 'development',
  /** 服务端口 */
  port: toNumber(process.env.PORT, 3000),
  /**
   * 反向代理信任跳数。默认 0 = 不信任 `X-Forwarded-For`，仅当服务确实部署在
   * 反向代理之后才设置（值等于代理跳数，如 1）。默认不启用可避免攻击者伪造来源 IP、
   * 绕过频率限制并污染审计日志。
   */
  trustProxy: toNumber(process.env.TRUST_PROXY, 0),
  /** 项目根目录（api/ 绝对路径） */
  rootDir: ROOT_DIR,
  /** 数据库配置 */
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME ?? 'ly_admin',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    // 数据库日志默认开启：SQL 写入 logs/db/ 日志文件；显式设 DB_LOGGING=false 可关闭
    logging: toBoolean(process.env.DB_LOGGING, true),
  },
  /** JWT 配置（密钥必填：缺失即抛错拒绝启动，禁止硬编码默认值） */
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET', `请执行以下命令生成后写入 api/.env：${SECRET_GEN_HINT}`),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', `请执行以下命令生成后写入 api/.env：${SECRET_GEN_HINT}`),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  /** 登录图形验证码 */
  captcha: {
    /** 是否启用（默认启用）；设 false 可关闭（如自动化测试环境） */
    enabled: toBoolean(process.env.CAPTCHA_ENABLED, true),
    /** 验证码有效期（ms，默认 5 分钟） */
    ttlMs: toNumber(process.env.CAPTCHA_TTL_MS, 5 * 60 * 1000),
    /** 验证码字符数（默认 4） */
    length: toNumber(process.env.CAPTCHA_LENGTH, 4),
  },
  /** 文件上传配置 */
  upload: {
    /** 上传根目录（绝对路径） */
    dir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR ?? 'uploads'),
    /** 相对 api/ 的目录名，用于拼接 URL */
    dirName: process.env.UPLOAD_DIR ?? 'uploads',
    /**
     * 图片缩放缓存目录（绝对路径），默认 <api>/cache/images。
     * 必须位于静态服务根目录（upload.dir）之外，避免缓存文件被公开访问；
     * 可用 UPLOAD_CACHE_DIR 覆盖。
     */
    cacheDir: path.resolve(ROOT_DIR, process.env.UPLOAD_CACHE_DIR ?? 'cache/images'),
    /** 单文件大小上限（字节） */
    maxSize: toNumber(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    /** 单次最多文件数 */
    maxCount: toNumber(process.env.UPLOAD_MAX_COUNT, 10),
    /**
     * 防盗链 Referer 白名单（host 列表，已归一为小写）。
     * 放行规则：无 Referer、同源（与请求 host 一致）、命中本白名单之一。
     * 前后端分离部署（端口不同）时，需把前端 origin 配进来，否则静态资源会被判为外链。
     */
    allowedReferers: parseRefererHosts(process.env.UPLOAD_ALLOWED_REFERERS),
  },
  /** 前端构建产物（同源部署时由后端直接托管） */
  web: {
    /**
     * 前端产物目录（绝对路径）。
     * 默认取 `api/web`（与后端同目录，便于整目录部署）；可用 WEB_DIST_DIR 覆盖。
     * 注意：不要用 `api/dist` —— 那是后端 TS 的编译输出目录，会被 `npm run build` 覆盖。
     * 目录不存在时后端跳过托管（纯 API 部署 / 前端独立部署场景不受影响）。
     */
    distDir: path.resolve(ROOT_DIR, process.env.WEB_DIST_DIR ?? 'web'),
  },
  /**
   * Redis 配置（登出令牌黑名单 / 登录频率限制的共享存储）。
   * 未配置 REDIS_HOST 时视为「不启用」，相关增强整体降级关闭（见 config/redis.ts）。
   */
  redis: {
    host: process.env.REDIS_HOST ?? '',
    port: toNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD ?? '',
    db: toNumber(process.env.REDIS_DB, 0),
  },
  /** 跨域允许来源 */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** 日志目录（绝对路径） */
  logDir: LOG_DIR,
  /** 日志系统配置（按天分文件 + 定时归档） */
  log: {
    /** 日志根目录（绝对路径），即 config.logDir，语义化别名 */
    dir: LOG_DIR,
    /** 归档根目录（绝对路径），默认 <logDir>/archive；可用 LOG_ARCHIVE_DIR 覆盖 */
    archiveDir: path.resolve(
      ROOT_DIR,
      process.env.LOG_ARCHIVE_DIR ?? path.join(process.env.LOG_DIR ?? 'logs', 'archive'),
    ),
    /** 每日归档时刻：小时（本地时区，0-23，默认 0） */
    archiveHour: toNumber(process.env.LOG_ARCHIVE_HOUR, 0),
    /** 每日归档时刻：分钟（本地时区，0-59，默认 5） */
    archiveMinute: toNumber(process.env.LOG_ARCHIVE_MINUTE, 5),
    /** 归档成功后是否保留源 .log（false=删除，默认 false） */
    keepSourceAfterArchive: toBoolean(process.env.LOG_ARCHIVE_KEEP_SOURCE, false),
    /** 慢 SQL 阈值（ms，默认 200） */
    slowSqlMs: toNumber(process.env.LOG_SLOW_SQL_MS, 200),
    /** 可选的 tar 可执行文件路径覆盖（跨平台/自定义环境用）；默认 PATH 中的 `tar` */
    tarBin: process.env.TAR_BIN ?? 'tar',

    // ── 日志保留策略（按时间列分批 DELETE 自动清理）──
    /**
     * HTTP 访问日志（sys_http_log）保留天数，默认 7。
     * 该表是磁盘增长主源（≈8.6GB/天@100QPS），访问日志的取证价值随时间快速衰减，故保留期最短。
     */
    httpLogRetentionDays: parseRetentionDays('LOG_HTTP_RETENTION_DAYS', 7),
    /** 操作日志（sys_operation_log）保留天数，默认 180。审计证据，需长期保留。 */
    operationLogRetentionDays: parseRetentionDays('LOG_OPERATION_RETENTION_DAYS', 180),
    /** 登录日志（sys_login_log）保留天数，默认 180（折中）。 */
    loginLogRetentionDays: parseRetentionDays('LOG_LOGIN_RETENTION_DAYS', 180),
    /** 保留清理时刻：小时（本地时区，0-23，默认 0） */
    retentionHour: toNumber(process.env.LOG_RETENTION_HOUR, 0),
    /** 保留清理时刻：分钟（本地时区，0-59，默认 10，避开 00:05 归档以避免同一时刻抢 IO） */
    retentionMinute: toNumber(process.env.LOG_RETENTION_MINUTE, 10),
    /**
     * 是否启用日志保留清理（默认 true）。
     * 设为 false 为「紧急刹车」：不注册调度器、不执行清理（启动日志会明确打印“已禁用”）。
     */
    retentionEnabled: toBoolean(process.env.LOG_RETENTION_ENABLED, true),
    /**
     * 是否输出 HTTP 日志 count 缓存的命中/未命中调试日志（默认 false）。
     * 仅用于验证短 TTL 计数缓存效果，生产默认关闭，不影响接口返回契约。
     */
    httpCountCacheDebug: toBoolean(process.env.LOG_HTTP_COUNT_CACHE_DEBUG, false),
  },
} as const;

export type AppConfig = typeof config;
