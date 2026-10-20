/**
 * CLI 脚本的配置依赖回归测试。
 *
 * 背景（真实事故）：`scripts/prisma-comments.ts` 原本 import 服务端配置 `config.ts`，
 * 而后者在模块加载时就会 fail-fast 校验 JWT 密钥。compose 的 `migrate` 服务环境里
 * 只有 DB_*，于是 `prisma:comments` 还没跑就抛错退出码 1，部署卡在"迁移成功之后"。
 * 该路径此前从未被执行过（开发机没有 Docker，CI 只构建镜像不跑 compose）。
 *
 * 两条约定在这里被锁死：
 * 1. `scripts/` 下的 CLI 脚本只允许依赖 `db-config`（无 fail-fast），不许依赖服务端 `config`；
 * 2. `db-config` 自身在缺少 JWT 密钥的环境里也能加载。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../src/common/config/config.js';

const SCRIPTS_DIR = path.resolve(__dirname, '../scripts');

describe('CLI 脚本不继承服务端配置的 fail-fast', () => {
  it('scripts/ 下没有文件 import 服务端 config', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(SCRIPTS_DIR).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(path.join(SCRIPTS_DIR, file), 'utf8');
      if (/from ['"][^'"]*common\/config\/config\.js['"]/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('db-config 在没有 JWT 密钥的环境里也能加载', async () => {
    const access = process.env.JWT_ACCESS_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    try {
      vi.resetModules();
      const { dbConfig } = await import('../src/common/config/db-config.js');
      // 与已加载的服务端配置同值：证明拆分没有改变取值口径
      expect(dbConfig.host).toBe(config.db.host);
      expect(dbConfig.port).toBe(config.db.port);
      expect(dbConfig.name).toBe(config.db.name);
      expect(dbConfig.connectionLimit).toBe(config.db.connectionLimit);
    } finally {
      if (access !== undefined) process.env.JWT_ACCESS_SECRET = access;
      if (refresh !== undefined) process.env.JWT_REFRESH_SECRET = refresh;
      vi.resetModules();
    }
  });
});
