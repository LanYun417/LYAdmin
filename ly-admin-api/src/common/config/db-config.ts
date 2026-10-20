/**
 * 数据库连接配置（**无 fail-fast 校验**）。
 *
 * 为什么单独一个文件：`config.ts` 是服务端配置中心，模块加载时就会校验 JWT 等必填项，
 * 缺一项直接抛错拒绝启动。而 `scripts/prisma-comments.ts` 这类 CLI 脚本只关心数据库连接，
 * 让它们 import `config.ts` 就会被服务端的必填项拦住——真实事故：compose 的 `migrate`
 * 服务跑 `prisma:comments` 时环境里没有 JWT 密钥，脚本退出码 1，部署卡在迁移之后。
 *
 * 约定：这里只放"连数据库需要的少量项"，默认值必须与 `config.ts` 中的其它配置保持同一口径；
 * 新增环境变量仍按 03-环境与配置 的规则走，不要在这里复制粘贴出一套平行配置。
 */
import { toBoolean, toNumber } from './env-parse.js';

export const dbConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: toNumber(process.env.DB_PORT, 3306),
  name: process.env.DB_NAME ?? 'ly_admin',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  logging: toBoolean(process.env.DB_LOGGING, true),
  /** 连接池上限：默认 10，限制在 1~100，避免配置失误打满数据库 */
  connectionLimit: Math.min(Math.max(toNumber(process.env.DB_CONNECTION_LIMIT, 10), 1), 100),
} as const;
