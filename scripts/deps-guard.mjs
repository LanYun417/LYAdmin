#!/usr/bin/env node
/**
 * 零依赖哨兵（F8 · 差异化能力）。
 * 模块职责：把「零第三方运行时依赖」这条项目身份约束从「口头约定」变成「可执行校验」——
 * 任何人 `npm i` 一个包即被拦截。
 *
 * 校验对象：项目根 / api / admin 三处 `package.json`。
 * 校验规则：
 * - `dependencies`（运行时依赖）新增 / 移除 / 版本变更 → 校验失败（退出码 1），逐条列出哪个包、哪处 package.json；
 * - `devDependencies` 变化 → 仅告警（退出码 0），因为测试/工具类依赖不破坏运行时零依赖约束；
 * - `--update`：显式把当前三处 package.json 的依赖写入基线（用于确实需要变更依赖时的显式动作，
 *   而非静默通过）；执行更新本身不应隐式被 CI 使用。
 *
 * 依赖基线文件：`scripts/deps-baseline.json`（与脚本同目录）。
 *
 * 约束：本脚本零第三方依赖，仅使用 Node 内置模块。
 * 用法：
 *   node scripts/deps-guard.mjs            # 校验（失败退出码 1）
 *   node scripts/deps-guard.mjs --update   # 更新基线
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 项目根目录（scripts/ 的上一级）。 */
const ROOT_DIR = path.resolve(__dirname, '..');

/** 基线快照文件绝对路径。 */
const BASELINE_PATH = path.join(__dirname, 'deps-baseline.json');

/** 待校验的三处 package.json（相对项目根目录，顺序即输出顺序）。 */
const TARGETS = ['package.json', 'api/package.json', 'admin/package.json'];

/**
 * 读取并解析 JSON 文件。
 * @param {string} file 绝对路径
 * @returns {Record<string, unknown>} 解析后的对象
 */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * 抽取某处 package.json 的依赖清单（缺失时归一为 {}）。
 * @param {Record<string, unknown>} pkg package.json 内容
 * @returns {{ dependencies: Record<string, string>, devDependencies: Record<string, string> }}
 */
function extractDeps(pkg) {
  return {
    dependencies: /** @type {Record<string, string>} */ (pkg.dependencies ?? {}),
    devDependencies: /** @type {Record<string, string>} */ (pkg.devDependencies ?? {}),
  };
}

/**
 * 生成当前三处 package.json 的依赖快照。
 * @returns {{ generatedAt: string, packages: Record<string, { dependencies: Record<string, string>, devDependencies: Record<string, string> }> }} 快照对象
 * @throws 任一目标 package.json 缺失时抛出
 */
function buildSnapshot() {
  /** @type {Record<string, { dependencies: Record<string, string>, devDependencies: Record<string, string> }>} */
  const packages = {};
  for (const rel of TARGETS) {
    const abs = path.join(ROOT_DIR, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`未找到 ${rel}（预期路径：${abs}）`);
    }
    packages[rel] = extractDeps(readJson(abs));
  }
  return { generatedAt: new Date().toISOString(), packages };
}

/**
 * 比较两个依赖映射，返回差异清单。
 * @param {Record<string, string>} base 基线依赖
 * @param {Record<string, string>} current 当前依赖
 * @returns {{ added: string[], removed: string[], changed: string[] }} 差异（added/removed 形如 `pkg@ver`，changed 形如 `pkg: old → new`）
 */
function diffDeps(base, current) {
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const changed = [];

  for (const name of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(base, name)) {
      added.push(`${name}@${current[name]}`);
    } else if (base[name] !== current[name]) {
      changed.push(`${name}: ${base[name]} → ${current[name]}`);
    }
  }
  for (const name of Object.keys(base)) {
    if (!Object.prototype.hasOwnProperty.call(current, name)) {
      removed.push(`${name}@${base[name]}`);
    }
  }
  return { added, removed, changed };
}

/** 差异总条数。 */
function diffCount(diff) {
  return diff.added.length + diff.removed.length + diff.changed.length;
}

/**
 * 逐条打印某处 package.json 的依赖差异。
 * @param {'+ 新增'|'- 移除'|'~ 版本变更'} label 前缀标签
 * @param {string[]} items 差异条目
 * @param {(msg: string) => void} sink 输出函数（console.error / console.warn）
 */
function printItems(label, items, sink) {
  for (const item of items) {
    sink(`    ${label}  ${item}`);
  }
}

/**
 * 执行 `--update`：把当前依赖写入基线文件。
 * @returns {number} 退出码（恒为 0，异常时由 main 捕获）
 */
function updateBaseline() {
  const snapshot = buildSnapshot();
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[DepsGuard] ✅ 基线已更新：${path.relative(ROOT_DIR, BASELINE_PATH)}`);
  console.log(`[DepsGuard] 已收录 ${TARGETS.length} 处 package.json 的 dependencies / devDependencies。`);
  return 0;
}

/**
 * 执行校验：对比当前依赖与基线。
 * @returns {number} 退出码（0 通过 / 1 失败）
 */
function check() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('[DepsGuard] ❌ 未找到基线文件 scripts/deps-baseline.json');
    console.error('[DepsGuard] 请先运行 `node scripts/deps-guard.mjs --update` 生成基线后重试。');
    return 1;
  }

  const baseline = readJson(BASELINE_PATH);
  const current = buildSnapshot();
  const basePackages =
    /** @type {Record<string, { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }>} */ (
      baseline.packages ?? {}
    );

  let failed = false;
  /** @type {string[]} */
  const warnings = [];

  for (const rel of TARGETS) {
    const base = basePackages[rel];
    const currentDeps = current.packages[rel];

    if (!base) {
      warnings.push(`${rel} 不在基线快照中（新增的 package.json？），本次已跳过校验。`);
      continue;
    }

    const runtimeDiff = diffDeps(base.dependencies ?? {}, currentDeps.dependencies);
    const devDiff = diffDeps(base.devDependencies ?? {}, currentDeps.devDependencies);

    if (diffCount(runtimeDiff) > 0) {
      failed = true;
      console.error(`[DepsGuard] ❌ ${rel} 的 dependencies（运行时依赖）发生变更：`);
      printItems('+ 新增', runtimeDiff.added, console.error);
      printItems('- 移除', runtimeDiff.removed, console.error);
      printItems('~ 版本变更', runtimeDiff.changed, console.error);
    }

    if (diffCount(devDiff) > 0) {
      const detail = [
        ...devDiff.added.map((item) => `+ ${item}`),
        ...devDiff.removed.map((item) => `- ${item}`),
        ...devDiff.changed.map((item) => `~ ${item}`),
      ].join('，');
      warnings.push(`${rel} 的 devDependencies 发生变化（仅告警，不阻断）：${detail}`);
    }
  }

  for (const warning of warnings) {
    console.warn(`[DepsGuard] ⚠️  ${warning}`);
  }

  if (failed) {
    console.error('[DepsGuard] 运行时依赖变更会破坏「零第三方运行时依赖」约束，已阻断。');
    console.error('[DepsGuard] 如确需变更，请显式运行 `npm run guard:deps -- --update` 更新基线，并在评审中说明原因。');
    return 1;
  }

  console.log('[DepsGuard] ✅ 三处 package.json 的运行时依赖（dependencies）均与基线一致。');
  return 0;
}

/** 打印帮助。 */
function printHelp() {
  console.log('零依赖哨兵（F8）');
  console.log('');
  console.log('用法：');
  console.log('  node scripts/deps-guard.mjs            校验三处 package.json 依赖是否偏离基线');
  console.log('  node scripts/deps-guard.mjs --update   显式更新基线（scripts/deps-baseline.json）');
  console.log('');
  console.log('规则：dependencies（运行时）变更 → 失败；devDependencies 变更 → 仅告警。');
}

/**
 * 入口。
 * @returns {number} 进程退出码
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }
  if (args.includes('--update')) {
    return updateBaseline();
  }
  return check();
}

try {
  process.exit(main());
} catch (error) {
  console.error('[DepsGuard] ❌ 执行异常:', error instanceof Error ? error.message : error);
  process.exit(1);
}
