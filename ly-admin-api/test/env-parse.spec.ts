import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadDotEnv } from '../src/common/config/env-parse.js';

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');

/**
 * 复原策略：本文件只动 ly-admin-api/.env（gitignored），且必须还原。
 * - 若原本就存在：备份内容，测完写回；
 * - 若原本不存在：临时创建一个，测完删除。
 * 同时还原 process.env.DB_PASSWORD，避免污染同进程内的其它测试文件。
 *
 * 注意：本文件顶部静态 `import { loadDotEnv }` 会在导入时执行一次 `loadDotEnv()`，
 * 把真实 `.env` 的 DB_PASSWORD 预置进 process.env。下面的用例在重新导入前会先 `delete`
 * 该变量，确保加载器能从新写入的文件重新读取（加载器只在变量缺失时补充，不覆盖）。
 */
let backup: string | null = null;
let created = false;
const envBefore = process.env.DB_PASSWORD;

afterEach(() => {
  if (backup !== null) {
    fs.writeFileSync(envPath, backup);
    backup = null;
  } else if (created) {
    fs.rmSync(envPath, { force: true });
    created = false;
  }
  if (envBefore === undefined) {
    delete process.env.DB_PASSWORD;
  } else {
    process.env.DB_PASSWORD = envBefore;
  }
});

function ensureEnvWithPassword(sentinel: string): void {
  if (fs.existsSync(envPath)) {
    backup = fs.readFileSync(envPath, 'utf-8');
    const lines = backup.split(/\r?\n/).filter((l) => !l.startsWith('DB_PASSWORD='));
    lines.push(`DB_PASSWORD=${sentinel}`);
    fs.writeFileSync(envPath, lines.join('\n'));
  } else {
    created = true;
    fs.writeFileSync(envPath, `DB_PASSWORD=${sentinel}\n`);
  }
}

describe('env-parse / 配置加载顺序', () => {
  it('dbConfig 必须在 .env 解析后才定型（修复 loadDotEnv 晚于 db-config 求值的坑）', async () => {
    const sentinel = 'regression_sentinel_pwd';
    ensureEnvWithPassword(sentinel);
    // 清除预置值，确保 env-parse 顶层 loadDotEnv() 能从新写入的 .env 重新读取。
    delete process.env.DB_PASSWORD;

    // 重置模块注册表后动态导入，确保 env-parse 的顶层 loadDotEnv() 重新执行并读入哨兵值。
    vi.resetModules();
    const mod = await import('../src/common/config/db-config.js');

    // 若 loadDotEnv 仍在 config.ts 顶部（晚于 db-config 求值），此处会是空串 '' → 测试失败。
    expect(mod.dbConfig.password).toBe(sentinel);
  });

  it('loadDotEnv 只补充缺失变量，不覆盖已存在的环境变量', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-parse-'));
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'DB_PASSWORD=fromfile\nEXISTING=fromfile\n');
      delete process.env.DB_PASSWORD;
      process.env.EXISTING = 'fromenv';
      loadDotEnv(dir);
      expect(process.env.DB_PASSWORD).toBe('fromfile');
      // 已存在的环境变量不应被 .env 覆盖（容器 / 命令行注入优先）。
      expect(process.env.EXISTING).toBe('fromenv');
    } finally {
      delete process.env.DB_PASSWORD;
      delete process.env.EXISTING;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
