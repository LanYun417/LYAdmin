/**
 * Prisma CLI 配置文件（Prisma 7 约定）。
 *
 * Prisma 7 起，`datasource.url` 不再写在 schema 文件里：
 * - Migrate / Studio / db push 等 CLI 命令的连接串由本文件提供；
 * - 应用运行期的连接则通过 driver adapter（@prisma/adapter-mariadb）在 PrismaService 中注入。
 *
 * 本文件从 `.env` 读取 DB_* 变量并拼装连接串，与 src/common/config/config.ts 保持同一数据源。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * 读取项目根 `.env`。
 * 与 `src/common/config/config.ts` 的解析口径一致（KEY=VALUE、去成对引号、已存在的环境变量优先），
 * 这样 CLI 与运行期不会读到不同的连接参数。
 */
function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }
  for (const rawLine of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

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
    /** 手动种子入口（表结构同步用 `npm run prisma:push`） */
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: dbUrl(),
  },
});
