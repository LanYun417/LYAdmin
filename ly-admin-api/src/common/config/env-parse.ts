/**
 * 环境变量解析原语 + 配置前置加载。
 *
 * 单独成档的原因：`config.ts` 是**带 fail-fast 校验**的服务端配置中心（缺 JWT 密钥直接抛错），
 * 而某些 CLI 脚本（如 `scripts/prisma-comments.ts`）只需要数据库连接信息。
 * 若让它们 import `config.ts`，就会被服务端的必填项校验拦住——
 * 真实事故：compose 的 `migrate` 服务执行 `prisma:comments` 时因环境里没有 JWT 密钥而退出码 1，
 * 整个部署卡在迁移后一步。故把无副作用的解析函数拆出来，供两边共用。
 *
 * ⚠️ 关键约定：本模块在**顶层立即执行 `loadDotEnv()`**。
 * `db-config.ts` 依赖本模块，而它会在求值阶段直接读取 `process.env.DB_*` 来固化数据库连接配置；
 * ES 模块的 import 会提升——若把 `loadDotEnv()` 调用放在 `config.ts` 顶部，它永远晚于被导入模块
 * （db-config）的求值，导致 `dbConfig` 在 `.env` 文件被解析前就被算成空密码。该 bug 只在「本地原生
 * 启动、配置来自 `.env` 文件」时暴露（容器因 `DB_*` 已注入为真实环境变量而不受影响）。
 * 把加载动作放在本模块顶层，保证任何读取 env 的配置在被求值前，`.env` 已被载入 `process.env`。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

/**
 * 项目根目录（<root>，即 ly-admin-api/）。
 *
 * ⚠️ 依赖目录层级约定：编译产物必须保留 `dist` 这一层 —— 即 env-parse.js
 * 始终位于 `<root>/dist/common/config/` 下。这样 `../../..` 才能正确解析到 `<root>`。
 * 若把 dist/* 直接平铺进部署目录（丢掉 dist 层），往上 3 级会越过根、指到父级，
 * 导致 uploads / logs / cache 与 .env 被建在部署目录的上一级。不要扁平打包，
 * 参见项目记忆「后端 ROOT_DIR 解析」约定。
 */
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * 极简 .env 解析器。
 * 不依赖 dotenv：本项目只需读取 KEY=VALUE 形式的简单赋值，自实现避免引入运行时依赖。
 * 已存在的环境变量优先（便于容器 / 命令行覆盖）。
 *
 * @param rootDir 从此目录读取 `.env`，默认项目根。供测试注入临时目录。
 */
export function loadDotEnv(rootDir: string = ROOT_DIR): void {
  const envPath = path.resolve(rootDir, '.env');
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

// 必须在任何读取 process.env 的配置模块求值之前执行（见文件头说明）。
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
