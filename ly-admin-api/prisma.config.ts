/**
 * Prisma CLI 配置文件（Prisma 7 约定）。
 *
 * Prisma 7 起，`datasource.url` 不再写在 schema 文件里：
 * - Migrate / Studio / db push 等 CLI 命令的连接串由本文件提供；
 * - 应用运行期的连接则通过 driver adapter（@prisma/adapter-mysql）在 PrismaService 中注入。
 *
 * 本文件从 `.env` 读取 DB_* 变量并拼装连接串，与 src/common/config.ts 保持同一数据源。
 */
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/** 从环境变量读取数据库配置（缺省与 config.ts 保持一致）。 */
function dbUrl(): string {
  const explicit = process.env.DATABASE_URL;
  if (explicit) {
    return explicit;
  }
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '3306';
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const name = process.env.DB_NAME ?? 'ly_admin';
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export default defineConfig({
  // 目录式 schema（Prisma 支持把模型按域拆到同目录的多个 .prisma 文件）
  // 注意：文件内 generator 的 output 是**相对 schema 目录**解析的，故为 ../../src/generated/prisma
  schema: path.join('prisma', 'schema'),
  migrations: {
    /** 使用 db push 而非 migrate（贴近原 sequelize.sync() 的自动建表体验） */
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: dbUrl(),
  },
});
