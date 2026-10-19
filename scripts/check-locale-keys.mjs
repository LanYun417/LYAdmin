/**
 * 语言包一致性检查（zh-CN 与 en-US 的 key 必须完全对齐）。
 *
 * 为什么需要门禁：漏一个 key 时不会报错，只会在英文界面露出中文（或 key 原文），
 * 属于「看起来能跑、实际很难发现」的问题——用脚本在 CI 里挡住最省事。
 *
 * 规则：
 * - 两侧的 key 集合必须完全相同（缺一即失败）；
 * - 叶子值不能为空字符串；
 * - 插值占位符（如 {count}）必须成对出现，否则切换语言后会露出原始占位符。
 *
 * 用法：node scripts/check-locale-keys.mjs（根目录 npm run guard:locale）
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = path.join(ROOT, 'ly-admin-web/src/locales');
const BASE_LOCALE = 'zh-CN';
const OTHER_LOCALES = ['en-US'];

/** 从语言包源码里提取 key → 值（只解析对象字面量，不引入 TS 运行时）。 */
function parseLocale(file) {
  const source = readFileSync(file, 'utf8');
  // 只剥掉 `export default`。⚠️ 曾经用 `/^\s*import[^;]+;\s*$/gm` 剥 import，
  // 结果该正则会跨行匹配（`\s*` 含换行），把注释到最后一个分号的整段内容一起吞掉，
  // 42 个 key 只解析出 8 个却"检查通过"——比没有门禁更危险。import 行本来就匹配不上
  // 下面两条正则，会被自然忽略。
  const body = source.replace(/^export\s+default\s*/m, '');
  const messages = {};
  let section = '';
  const lines = body.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
      continue;
    }
    const sectionMatch = /^'?([A-Za-z0-9_-]+)'?\s*:\s*\{$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (line === '},') {
      section = '';
      continue;
    }
    const entryMatch = /^([A-Za-z0-9_]+):\s*'((?:[^'\\]|\\.)*)',?$/.exec(line);
    if (entryMatch && section) {
      messages[`${section}.${entryMatch[1]}`] = entryMatch[2].replace(/\\'/g, "'");
    }
  }
  return messages;
}

/** 取字符串里的 {xxx} 占位符集合 */
function placeholders(text) {
  return new Set((String(text).match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort());
}

const basePath = path.join(LOCALES_DIR, `${BASE_LOCALE}.ts`);
let base;
try {
  base = parseLocale(basePath);
} catch (error) {
  console.error(`[LocaleGuard] ❌ 读取基准语言包失败：${basePath}`);
  console.error(error);
  process.exit(1);
}

if (Object.keys(base).length === 0) {
  console.error(`[LocaleGuard] ❌ 基准语言包 ${BASE_LOCALE}.ts 未解析出任何 key（脚本与文件结构不匹配？）`);
  process.exit(1);
}

const problems = [];

for (const locale of OTHER_LOCALES) {
  const file = path.join(LOCALES_DIR, `${locale}.ts`);
  let other;
  try {
    other = parseLocale(file);
  } catch (error) {
    console.error(`[LocaleGuard] ❌ 读取语言包失败：${file}`);
    console.error(error);
    process.exit(1);
  }

  for (const key of Object.keys(base)) {
    if (!(key in other)) {
      problems.push(`${locale} 缺少 key：${key}`);
      continue;
    }
    if (String(other[key]).trim() === '') {
      problems.push(`${locale} 的 ${key} 为空字符串`);
    }
    const basePlaceholders = placeholders(base[key]);
    const otherPlaceholders = placeholders(other[key]);
    if (basePlaceholders.size !== otherPlaceholders.size) {
      problems.push(
        `${locale} 的 ${key} 占位符与 ${BASE_LOCALE} 不一致（期望 {${[...basePlaceholders].join('},{')}}，实际 {${[...otherPlaceholders].join('},{')}）`,
      );
    }
  }

  for (const key of Object.keys(other)) {
    if (!(key in base)) {
      problems.push(`${locale} 多出 key（${BASE_LOCALE} 没有）：${key}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`[LocaleGuard] ❌ 语言包不一致（${problems.length} 处）：`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(
  `[LocaleGuard] ✅ 语言包一致：${Object.keys(base).length} 个 key × ${[BASE_LOCALE, ...OTHER_LOCALES].join(' / ')}`,
);
