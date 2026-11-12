#!/usr/bin/env node
/**
 * 构建预算哨兵：前端产物超过预算即门禁失败（退出码 1）。
 *
 * 背景：`chunkSizeWarningLimit` 只是 **warning**（Build 输出不阻塞 CI），
 * 大依赖被误引全量打包时没人看 warning 就等于没有门禁。本脚本把预算变成
 * 硬失败，并同时给出「单文件上限 / 命名 vendor 块上限 / assets 总量」三道线。
 *
 * 用法：
 *   node scripts/bundle-budget.mjs            # 校验 ly-admin-web/dist/assets（失败退出码 1）
 *   node scripts/bundle-budget.mjs --json     # 机器可读输出
 *
 * 预算文件：scripts/bundle-budget.json（与脚本同目录），调整上限改它。
 * 约束：零第三方依赖，仅 Node 内置模块。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DIST_ASSETS = path.join(ROOT, 'ly-admin-web', 'dist', 'assets');
const BUDGET_FILE = path.join(path.dirname(__filename), 'bundle-budget.json');

const asJson = process.argv.includes('--json');

/** 读取预算文件（缺失/损坏直接失败：静默跳过等于没有门禁）。 */
function loadBudget() {
  try {
    return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  } catch (error) {
    console.error(`[bundle-budget] 读取预算文件失败: ${BUDGET_FILE}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}

function main() {
  const budget = loadBudget();

  if (!fs.existsSync(DIST_ASSETS)) {
    console.error(`[bundle-budget] 产物目录不存在: ${DIST_ASSETS}（先执行 npm run build）`);
    process.exit(1);
  }

  /** 只统计 JS/CSS 产物（字体/图片由 vite 直接拷贝，不进 assets 的预算语义）。 */
  const files = fs
    .readdirSync(DIST_ASSETS)
    .filter((name) => /\.(js|mjs|css)$/.test(name))
    .map((name) => ({ name, bytes: fs.statSync(path.join(DIST_ASSETS, name)).size }))
    .sort((left, right) => right.bytes - left.bytes);

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const breaches = [];

  // 1) 单文件上限
  for (const file of files) {
    if (file.bytes > budget.singleFileKb * 1024) {
      breaches.push({
        kind: '单文件',
        target: file.name,
        actual: formatKb(file.bytes),
        limit: `${budget.singleFileKb}KB`,
      });
    }
  }

  // 2) 命名 vendor 块上限（按 chunk 名前缀匹配：element-plus-<hash>.js）
  for (const [chunk, limitKb] of Object.entries(budget.chunks ?? {})) {
    const matched = files.filter((file) => file.name.startsWith(`${chunk}-`));
    const actual = matched.reduce((sum, file) => sum + file.bytes, 0);
    if (actual > limitKb * 1024) {
      breaches.push({ kind: '命名块', target: chunk, actual: formatKb(actual), limit: `${limitKb}KB` });
    }
  }

  // 3) assets 总量
  if (totalBytes > budget.totalAssetsMb * 1024 * 1024) {
    breaches.push({
      kind: '总量',
      target: 'dist/assets',
      actual: `${(totalBytes / 1024 / 1024).toFixed(2)}MB`,
      limit: `${budget.totalAssetsMb}MB`,
    });
  }

  const report = {
    ok: breaches.length === 0,
    total: `${(totalBytes / 1024 / 1024).toFixed(2)}MB`,
    top: files.slice(0, 8).map((file) => `${formatKb(file.bytes)} ${file.name}`),
    breaches,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(`[bundle-budget] ✅ 产物 ${report.total}，预算内（最大的 8 个文件）`);
    for (const line of report.top) {
      console.log(`  ${line}`);
    }
  } else {
    console.error(`[bundle-budget] ❌ 产物 ${report.total}，超出预算 ${breaches.length} 项：`);
    for (const breach of breaches) {
      console.error(`  ${breach.kind}: ${breach.target} = ${breach.actual} > 上限 ${breach.limit}`);
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main();
