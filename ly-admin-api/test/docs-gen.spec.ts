/**
 * 接口文档生成器：重复生成必须字节级一致。
 *
 * 背景：产物曾因 readdirSync 顺序漂移出现 600+ 行纯排序 diff（不同环境生成互不相同），
 * 使 prebuild 的自动生成把无关重排塞进业务提交。本测试把生成器跑两遍到临时目录，
 * 逐字节比对两份产物，从机制上保证「同一份代码 ⇒ 同一份文档」。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(API_ROOT, 'scripts', 'gen-api-docs.mjs');
const tempDirs: string[] = [];

function generateOnce(): { docs: string; openapi: string } {
  const outDir = mkdtempSync(path.join(tmpdir(), 'ly-docs-gen-'));
  tempDirs.push(outDir);
  execFileSync(process.execPath, [SCRIPT, '--out', outDir], { cwd: API_ROOT, stdio: 'pipe' });
  return {
    docs: readFileSync(path.join(outDir, 'api-docs.generated.ts'), 'utf8'),
    openapi: readFileSync(path.join(outDir, 'openapi.generated.ts'), 'utf8'),
  };
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('gen-api-docs 确定性', () => {
  it('两次生成产物字节级一致', () => {
    const first = generateOnce();
    const second = generateOnce();
    expect(second.docs).toBe(first.docs);
    expect(second.openapi).toBe(first.openapi);
  });

  it('产物不含生成期内部字段（bodyDto/queryDto/isRaw）', () => {
    const { docs } = generateOnce();
    expect(docs).not.toMatch(/"bodyDto"/);
    expect(docs).not.toMatch(/"queryDto"/);
    expect(docs).not.toMatch(/"isRaw"/);
  });
});
