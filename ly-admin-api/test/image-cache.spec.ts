/**
 * 缩略图缓存清理单测（真实临时目录，不 mock fs）。
 *
 * 为什么要测：缓存目录原先只写不删，属「跑得越久磁盘越满」类缺陷，
 * 且清理逻辑含 TTL 与体积上限两条独立路径、以及「删除原文件时联动清理」，
 * 用真实文件系统验证才算数（mtime 用 utimes 伪造，避免 sleep）。
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/common/config/config.js';
import { ImageScaleService } from '../src/common/file/file-guards.js';

const originalCacheDir = config.upload.cacheDir;
const originalTtlDays = config.upload.cacheTtlDays;
const originalMaxMb = config.upload.cacheMaxMb;

let cacheDir: string;

/** 造一个「某原文件的某宽度」缓存文件，返回其绝对路径。 */
async function writeCacheFile(relativePath: string, width: number, bytes: number, ageDays: number): Promise<string> {
  const dir = join(cacheDir, createHash('sha256').update(relativePath).digest('hex'));
  await fsp.mkdir(dir, { recursive: true });
  const file = join(dir, `${width}.jpg`);
  await fsp.writeFile(file, Buffer.alloc(bytes, 1));
  if (ageDays > 0) {
    const past = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    await fsp.utimes(file, past, past);
  }
  return file;
}

describe('ImageScaleService 缓存清理', () => {
  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'ly-cache-'));
    (config.upload as { cacheDir: string }).cacheDir = cacheDir;
    (config.upload as { cacheTtlDays: number }).cacheTtlDays = 30;
    (config.upload as { cacheMaxMb: number }).cacheMaxMb = 512;
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    (config.upload as { cacheDir: string }).cacheDir = originalCacheDir;
    (config.upload as { cacheTtlDays: number }).cacheTtlDays = originalTtlDays;
    (config.upload as { cacheMaxMb: number }).cacheMaxMb = originalMaxMb;
  });

  it('clearFor 只删除该原文件的缓存目录，不动其它文件', async () => {
    const service = new ImageScaleService();
    const target = await writeCacheFile('png/a.png', 100, 1024, 0);
    const keep = await writeCacheFile('png/b.png', 100, 1024, 0);
    await writeCacheFile('png/a.png', 200, 1024, 0);

    await service.clearFor('png/a.png');

    expect(existsSync(join(cacheDir, createHash('sha256').update('png/a.png').digest('hex')))).toBe(false);
    expect(existsSync(keep)).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  it('TTL 到期条目被清理，未到期保留', async () => {
    const service = new ImageScaleService();
    const expired = await writeCacheFile('png/old.png', 100, 1024, 31);
    const fresh = await writeCacheFile('png/new.png', 100, 1024, 1);

    const result = await service.sweep();

    expect(result.removed).toBe(1);
    expect(existsSync(expired)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('超过体积上限时按最久未访问淘汰，直到降回上限内', async () => {
    (config.upload as { cacheMaxMb: number }).cacheMaxMb = 1; // 1MB 上限
    const service = new ImageScaleService();
    // 4 个 400KB 文件 ≈ 1.56MB，需淘汰 2 个（按 mtime 从最早开始）
    const oldest = await writeCacheFile('png/1.png', 100, 400 * 1024, 5);
    const second = await writeCacheFile('png/2.png', 100, 400 * 1024, 4);
    const third = await writeCacheFile('png/3.png', 100, 400 * 1024, 3);
    const newest = await writeCacheFile('png/4.png', 100, 400 * 1024, 1);

    const result = await service.sweep();

    expect(result.removed).toBeGreaterThanOrEqual(2);
    expect(existsSync(oldest)).toBe(false);
    expect(existsSync(second)).toBe(false);
    expect(existsSync(third) || existsSync(newest)).toBe(true);
    expect(existsSync(newest)).toBe(true);
  });

  it('TTL 与体积都为 0 时不删任何东西（紧急关断口径）', async () => {
    (config.upload as { cacheTtlDays: number }).cacheTtlDays = 0;
    (config.upload as { cacheMaxMb: number }).cacheMaxMb = 0;
    const service = new ImageScaleService();
    const file = await writeCacheFile('png/keep.png', 100, 10 * 1024 * 1024, 999);

    const result = await service.sweep();

    expect(result.removed).toBe(0);
    expect(existsSync(file)).toBe(true);
  });

  it('缓存目录不存在时安全返回（首次启动、目录被外部清掉）', async () => {
    rmSync(cacheDir, { recursive: true, force: true });
    const service = new ImageScaleService();
    await expect(service.sweep()).resolves.toEqual({ removed: 0, freedBytes: 0 });
  });
});
