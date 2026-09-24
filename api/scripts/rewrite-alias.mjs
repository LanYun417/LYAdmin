/**
 * 构建后别名重写脚本（零依赖，仅用 Node 内置模块）。
 *
 * 背景：tsconfig 的 `paths: {"@/*": ["./src/*"]}` 只在编译期生效，tsc **不会**重写 dist
 * 产物里的 `@/xxx` 模块引用，导致 `node dist/server.js` 启动即崩 `Cannot find module '@/app'`。
 * 本脚本在 `tsc` 之后运行，把 dist 下所有 .js 里的 `require("@/x")` / `import("@/x")`
 * 改写为相对当前文件的正确路径（`@/a/b` → `./a/b` 或 `../a/b`），从而打通生产启动（方案 C）。
 *
 * 约定与结论：
 * - 仅重写「模块引用」形态：`require("@/x")` 与动态 `import("@/x")`；
 *   不触碰源码字符串里的 `from '@/...'`（如 gen.templates.js 的代码生成模板字面量），
 *   那些是业务内容而非模块引用，必须原样保留。
 * - 别名 `@/` 映射到 `dist/` 根（src/ 与 dist/ 目录结构一致），后缀保持无扩展名，
 *   交由 Node CJS 解析规则（`.js` / `index.js`）补全，与源码语义一致。
 * - `.d.ts` 未被 tsc 产出（tsconfig `declaration: false`）；`.js.map` 的 `sources` 已是相对
 *   路径、不含 `@/`，因此二者均不影响运行，无需处理。
 * - 自检：重写后再次扫描，若仍有 `require("@/` / `import("@/` 残留 → 打印清单并 `exit(1)`，
 *   让问题在 build 期暴露而非运行期。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(API_ROOT, 'dist');

/** 需要处理的脚本扩展名。 */
const SCRIPT_EXTS = new Set(['.js', '.cjs', '.mjs']);

/** 匹配 `require("@/x")` / `import("@/x")`（同时兼容单双引号）。 */
const ALIAS_RE = /(require\(\s*|import\(\s*)(['"])@\/([^'"]+)\2/g;

/** 自检：残留的别名模块引用。 */
const RESIDUAL_RE = /(?:require|import)\(\s*['"]@\//;

/** 递归收集 dist 下所有脚本文件。 */
function collectScripts(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectScripts(full));
    } else if (SCRIPT_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** 把别名子路径（`@/` 之后部分）换算为相对当前文件的模块说明符。 */
function toRelativeSpecifier(subPath, filePath) {
  const targetAbs = path.join(DIST_DIR, subPath);
  let rel = path.relative(path.dirname(filePath), targetAbs).split(path.sep).join('/');
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel;
}

/** 主流程。 */
function main() {
  const files = collectScripts(DIST_DIR);
  if (files.length === 0) {
    console.warn(`[rewrite-alias] 未找到 dist 产物（${DIST_DIR}），请先执行 tsc 构建`);
    return;
  }

  let rewrittenFiles = 0;
  let rewrittenRefs = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let hits = 0;
    const output = source.replace(ALIAS_RE, (_match, prefix, quote, subPath) => {
      hits += 1;
      return `${prefix}${quote}${toRelativeSpecifier(subPath, file)}${quote}`;
    });
    if (hits > 0) {
      fs.writeFileSync(file, output);
      rewrittenFiles += 1;
      rewrittenRefs += hits;
    }
  }

  // 自检：确认无残留别名模块引用
  const residual = [];
  for (const file of files) {
    const output = fs.readFileSync(file, 'utf8');
    if (RESIDUAL_RE.test(output)) {
      residual.push(path.relative(DIST_DIR, file));
    }
  }

  console.log(
    `[rewrite-alias] 处理文件 ${files.length} 个，重写 ${rewrittenFiles} 个文件 / ${rewrittenRefs} 处引用，残留 ${residual.length} 处`,
  );

  if (residual.length > 0) {
    console.error('[rewrite-alias] 重写后仍存在残留别名引用，构建失败：');
    residual.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
}

main();
