/**
 * 导入完整性守卫：确认「已入库的文件」之间的相对导入都能在索引内解析。
 *
 * 为什么需要它：本地工作区可能包含**未入库**的源文件——若某个目录被 .gitignore 规则误伤
 * （例如脚手架自带的 `logs` 规则会连 `src/modules/logs/` 一起忽略），本地 typecheck / build
 * 依然全绿，但新克隆的仓库缺这些文件、构建直接失败。2026-10-16 实际踩过一次：
 * `ly-admin-api/src/modules/logs/` 的三个文件从未入库，而当时所有本地检查都是通过的。
 *
 * 本脚本只读取 `git ls-files` 的视角，因此等价于「干净克隆能否解析全部相对导入」。
 * 用法：npm run guard:imports
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** 生成产物与代码生成器的输出模板：其内的 import 文本不是本仓库的真实导入。 */
const SKIP_PATTERNS = [/\/src\/generated\//, /gen\.templates\.ts$/, /gen\.writer\.ts$/];

const files = execSync('git ls-files -z', { encoding: 'utf8' }).split('\0').filter(Boolean);
const tracked = new Set(files);
const codeFiles = files.filter(
  (file) => /\.(ts|mts|vue|mjs|cjs|js)$/.test(file) && !SKIP_PATTERNS.some((pattern) => pattern.test(file)),
);

/** 相对导入可能对应的目标文件（TS 里写 `.js` 后缀、Vue、目录 index）。 */
function candidatesFor(base) {
  const list = [base];
  if (base.endsWith('.js')) {
    list.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  }
  if (base.endsWith('.mjs')) {
    list.push(`${base.slice(0, -4)}.mts`);
  }
  list.push(`${base}.ts`, `${base}.vue`, `${base}/index.ts`);
  return list;
}

const problems = [];
for (const file of codeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const specs = [...source.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']*)'/g)]
    .map((match) => match[1])
    .filter((spec) => !spec.includes('${'));
  for (const spec of specs) {
    const base = path.posix.join(path.posix.dirname(file), spec);
    if (!candidatesFor(base).some((candidate) => tracked.has(candidate))) {
      problems.push(`${file} → ${spec}`);
    }
  }
}

console.log(`[ImportGuard] 检查了 ${codeFiles.length} 个已入库的代码文件`);
if (problems.length === 0) {
  console.log('[ImportGuard] ✅ 全部相对导入都能在索引内解析（等价于干净克隆可构建）');
} else {
  console.log(`[ImportGuard] ❌ 有 ${problems.length} 处相对导入在索引内找不到目标：`);
  for (const problem of problems) {
    console.log('   ' + problem);
  }
  console.log('[ImportGuard] 提示：多为 .gitignore 规则误伤源码目录，检查该目录是否被忽略。');
  process.exitCode = 1;
}
