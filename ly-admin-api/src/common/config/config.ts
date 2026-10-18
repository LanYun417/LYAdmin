/**
 * 环境配置中心。
 * 统一读取项目根 `.env`，导出强类型配置对象，供全局引用。
 * 模块职责：唯一的环境变量读取入口，禁止在其它模块直接读取 process.env。
 * 安全校验一律 fail-fast：缺失必填项即抛错，服务拒绝启动。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

/**
 * 项目根目录。
 * ESM 下无 `__dirname`，用 `import.meta.url` 反解目录：
 * - 源码运行（nest start）：本文件位于 <root>/src/common/config/ → 上溯三级
 * - 编译运行（node dist/main.js）：本文件位于 <root>/dist/common/config/ → 上溯三级
 * 两者一致。
 */
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * 极简 .env 解析器。
 *
 * 不依赖 dotenv：本项目只需读取 KEY=VALUE 形式的简单赋值，
 * 自实现可避免为一个「读文件」动作引入运行时依赖。
 * 已存在的环境变量优先（便于容器/命令行覆盖）。
 */
function loadDotEnv(): void {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((rawLine: string) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      return;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉成对包裹的引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

/** 将字符串布尔值安全转换为 boolean。 */
export function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

/** 将字符串数字安全转换为 number。 */
export function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** 日志根目录（绝对路径）。 */
/** 日志根目录（绝对路径）。 */
const LOG_DIR = path.resolve(ROOT_DIR, process.env.LOG_DIR ?? 'logs');

/**
 * 口令长度边界：先夹下限（6~32），再让上限不小于下限——
 * 若只写 `max(env, 8)`，把 PASSWORD_MIN_LENGTH 配成 32 而上限用默认 20 时，
 * 会出现「min > max」导致任何口令都校验不过。
 */
const PASSWORD_MIN_LENGTH = Math.min(Math.max(toNumber(process.env.PASSWORD_MIN_LENGTH, 8), 6), 32);
const PASSWORD_MAX_LENGTH = Math.min(Math.max(toNumber(process.env.PASSWORD_MAX_LENGTH, 20), PASSWORD_MIN_LENGTH), 64);

/**
 * 解析防盗链 Referer 白名单：接受逗号分隔的 origin（`http://a.com`）或裸 host（`a.com`），
 * 统一归一为小写的 host（含端口）。未配置时返回空数组（仅放行「无 Referer」与「同源」）。
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
 * 回退到默认值**并打印明确告警。同时对上界做合理性提示。
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

/** 两个 JWT 密钥：均为必填，且必须互不相同（否则 refreshToken 可直接当 accessToken 使用）。 */
const JWT_ACCESS_SECRET = requireEnv('JWT_ACCESS_SECRET', `请执行以下命令生成后写入 .env：${SECRET_GEN_HINT}`);
const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET', `请执行以下命令生成后写入 .env：${SECRET_GEN_HINT}`);
if (JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('[Config] JWT_ACCESS_SECRET 与 JWT_REFRESH_SECRET 必须不同，服务拒绝启动。');
}

/**
 * 读取必填的环境变量；缺失或为空时抛出清晰错误并终止启动（fail-fast）。
 *
 * 安全背景：JWT 密钥绝不允许回退默认值——硬编码默认值等于把签名密钥公开给全网，
 * 任何人均可伪造 Token。缺失即抛错，配合 Nest 启动流程直接退出。
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
   * 反向代理之后才设置。默认不启用可避免攻击者伪造来源 IP、绕过频率限制并污染审计日志。
   */
  trustProxy: toNumber(process.env.TRUST_PROXY, 0),
  /** 项目根目录（绝对路径） */
  rootDir: ROOT_DIR,
  /** 数据库配置 */
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME ?? 'ly_admin',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    logging: toBoolean(process.env.DB_LOGGING, true),
    // 连接池上限：默认 10，限制在 1~100，避免配置失误打满数据库
    connectionLimit: Math.min(Math.max(toNumber(process.env.DB_CONNECTION_LIMIT, 10), 1), 100),
  },
  /** JWT 配置（密钥必填：缺失、为空或两者相同均抛错拒绝启动） */
  jwt: {
    accessSecret: JWT_ACCESS_SECRET,
    refreshSecret: JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  /** 登录图形验证码 */
  captcha: {
    enabled: toBoolean(process.env.CAPTCHA_ENABLED, true),
    /** 验证码有效期（ms，默认 5 分钟） */
    ttlMs: toNumber(process.env.CAPTCHA_TTL_MS, 5 * 60 * 1000),
    /** 验证码字符数（默认 4） */
    length: toNumber(process.env.CAPTCHA_LENGTH, 4),
  },
  /** 文件上传配置 */
  upload: {
    /** 上传根目录（绝对路径，磁盘上的真实物理存储路径） */
    dir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR ?? 'uploads'),
    /** 相对项目根的存储目录名，用于拼接 DB 中记录的 filePath 并解析磁盘文件。 */
    dirName: process.env.UPLOAD_DIR ?? 'uploads',
    /**
     * 对外静态资源路由前缀（URL 上的挂载路径），默认 `static`。
     * 物理存储目录仍为 dirName(uploads)，二者刻意分离——存储路径不变，仅路由改名。
     */
    route: process.env.UPLOAD_ROUTE ?? 'static',
    /**
     * 图片缩放缓存目录（绝对路径），默认 <root>/cache/images。
     * 必须位于静态服务根目录（upload.dir）之外，避免缓存文件被公开访问。
     */
    cacheDir: path.resolve(ROOT_DIR, process.env.UPLOAD_CACHE_DIR ?? 'cache/images'),
    /** 单文件大小上限（字节） */
    maxSize: toNumber(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    /** 单次最多文件数 */
    maxCount: toNumber(process.env.UPLOAD_MAX_COUNT, 10),
    /** 防盗链 Referer 白名单（host 列表，已归一为小写）。 */
    allowedReferers: parseRefererHosts(process.env.UPLOAD_ALLOWED_REFERERS),
  },
  /** 前端构建产物（同源部署时由后端直接托管） */
  web: {
    /**
     * 前端产物目录（绝对路径）。默认取项目根下的 `web`；
     * 可用 WEB_DIST_DIR 覆盖。目录不存在时后端跳过托管。
     */
    distDir: path.resolve(ROOT_DIR, process.env.WEB_DIST_DIR ?? 'web'),
  },
  /**
   * Redis 配置（登出令牌黑名单 / 登录频率限制 / 验证码的共享存储）。
   * 未配置 REDIS_HOST 时视为「不启用」，相关增强整体降级关闭。
   */
  redis: {
    host: process.env.REDIS_HOST ?? '',
    port: toNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD ?? '',
    db: toNumber(process.env.REDIS_DB, 0),
  },
  /** 跨域允许来源 */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** ip2region 离线 IP 库配置（IP 归属地解析；数据文件缺失时自动降级关闭，不影响启动） */
  ip2region: {
    /** xdb 数据文件路径（绝对路径），默认 <root>/data/ip2region_v4.xdb */
    dbPath: path.resolve(ROOT_DIR, process.env.IP2REGION_DB_PATH ?? 'data/ip2region_v4.xdb'),
  },
  /** 日志目录（绝对路径） */
  logDir: LOG_DIR,
  /** 日志系统配置（按天分文件 + 定时归档） */
  log: {
    dir: LOG_DIR,
    /** 归档根目录（绝对路径），默认 <logDir>/archive */
    archiveDir: path.resolve(
      ROOT_DIR,
      process.env.LOG_ARCHIVE_DIR ?? path.join(process.env.LOG_DIR ?? 'logs', 'archive'),
    ),
    /** 每日归档时刻（本地时区） */
    archiveHour: toNumber(process.env.LOG_ARCHIVE_HOUR, 0),
    archiveMinute: toNumber(process.env.LOG_ARCHIVE_MINUTE, 5),
    /** 归档成功后是否保留源 .log（false=删除，默认 false） */
    keepSourceAfterArchive: toBoolean(process.env.LOG_ARCHIVE_KEEP_SOURCE, false),
    /** 慢 SQL 阈值（ms，默认 200） */
    slowSqlMs: toNumber(process.env.LOG_SLOW_SQL_MS, 200),
    /** 可选的 tar 可执行文件路径覆盖（跨平台/自定义环境用） */
    tarBin: process.env.TAR_BIN ?? 'tar',
    /** HTTP 访问日志保留天数，默认 7（磁盘增长主源，取证价值随时间快速衰减） */
    httpLogRetentionDays: parseRetentionDays('LOG_HTTP_RETENTION_DAYS', 7),
    /** 操作日志保留天数，默认 180（审计证据，需长期保留） */
    operationLogRetentionDays: parseRetentionDays('LOG_OPERATION_RETENTION_DAYS', 180),
    /** 登录日志保留天数，默认 180（折中） */
    loginLogRetentionDays: parseRetentionDays('LOG_LOGIN_RETENTION_DAYS', 180),
    /** 保留清理时刻（本地时间，默认 00:10，刻意避开 00:05 归档以避免同一时刻抢 IO） */
    retentionHour: toNumber(process.env.LOG_RETENTION_HOUR, 0),
    retentionMinute: toNumber(process.env.LOG_RETENTION_MINUTE, 10),
    /** 是否启用日志保留清理（false 为「紧急刹车」） */
    retentionEnabled: toBoolean(process.env.LOG_RETENTION_ENABLED, true),
    /** 是否输出 HTTP 日志 count 缓存的命中/未命中调试日志（默认 false） */
    httpCountCacheDebug: toBoolean(process.env.LOG_HTTP_COUNT_CACHE_DEBUG, false),
  },
  /** 安全响应头（零依赖实现，见 common/http/security-headers.ts） */
  security: {
    /**
     * Content-Security-Policy。默认空 = **不下发**：本项目前端是 Vue SPA，
     * Element Plus / Tailwind / ECharts 会注入内联样式与 canvas，
     * 过严的 CSP 会直接白屏，必须按实际部署显式配置（如
     * `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'`）。
     */
    csp: process.env.CSP_POLICY ?? '',
    /**
     * 是否下发 HSTS。仅在部署于 HTTPS 反向代理之后才有意义，
     * 故默认跟随 NODE_ENV=production，可由 SECURITY_HSTS 覆盖。
     */
    hsts: toBoolean(process.env.SECURITY_HSTS, process.env.NODE_ENV === 'production'),
  },
  /** 接口限流（按 IP 固定窗口；Redis 不可用时自动降级放行，不阻断业务） */
  rateLimit: {
    enabled: toBoolean(process.env.RATE_LIMIT_ENABLED, true),
    /** 窗口长度（ms），默认 1 分钟 */
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    /** 单窗口内单 IP 的默认上限（登录/验证码/文档等敏感接口另有收紧值，见中间件） */
    max: toNumber(process.env.RATE_LIMIT_MAX, 300),
  },
  /**
   * 口令策略（新增用户 / 重置密码 / 自助改密共用，见 common/auth/password-policy.ts）。
   * 只约束**新设置**的口令，不影响存量账号登录。
   */
  password: {
    /** 最小长度：默认 8，夹在 6~32 之间（低于 6 无意义，高于 32 会显著拖慢 bcrypt） */
    minLength: PASSWORD_MIN_LENGTH,
    /** 最大长度：默认 20，夹在最小长度~64 之间（bcrypt 只取前 72 字节，过长无收益） */
    maxLength: PASSWORD_MAX_LENGTH,
    /** 是否要求「字母 + 数字」组合（默认要求；纯数字弱口令是最常见的撞库起点） */
    requireComplexity: toBoolean(process.env.PASSWORD_REQUIRE_COMPLEXITY, true),
  },
} as const;

export type AppConfig = typeof config;
