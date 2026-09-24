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
  },
} as const;

export type AppConfig = typeof config;
