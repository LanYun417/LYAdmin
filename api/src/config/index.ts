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

/** 全局配置对象。 */
export const config = {
  /** 运行环境 */
  env: process.env.NODE_ENV ?? 'development',
  /** 服务端口 */
  port: toNumber(process.env.PORT, 3000),
  /** 项目根目录（api/ 绝对路径） */
  rootDir: ROOT_DIR,
  /** 数据库配置 */
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME ?? 'ly_admin',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    logging: toBoolean(process.env.DB_LOGGING, false),
  },
  /** JWT 配置 */
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'ly_admin_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'ly_admin_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  /** 文件上传配置 */
  upload: {
    /** 上传根目录（绝对路径） */
    dir: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR ?? 'uploads'),
    /** 相对 api/ 的目录名，用于拼接 URL */
    dirName: process.env.UPLOAD_DIR ?? 'uploads',
    /** 单文件大小上限（字节） */
    maxSize: toNumber(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    /** 单次最多文件数 */
    maxCount: toNumber(process.env.UPLOAD_MAX_COUNT, 10),
  },
  /** 跨域允许来源 */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** 日志目录（绝对路径） */
  logDir: path.resolve(ROOT_DIR, process.env.LOG_DIR ?? 'logs'),
} as const;

export type AppConfig = typeof config;
