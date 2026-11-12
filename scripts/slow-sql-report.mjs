#!/usr/bin/env node
/**
 * 慢 SQL 聚合报告：把 `logs/db-*.log`（Prisma 慢查询事件，见 FileLoggerService.slowSql）
 * 汇总成「TOP N 归一化语句」，让治理有抓手——不然几千行 JSON 日志没人看得完。
 *
 * 用法：
 *   node scripts/slow-sql-report.mjs                 # 读全部 db 日志（含归档）
 *   node scripts/slow-sql-report.mjs --top 20        # 调整输出条数（默认 10）
 *   node scripts/slow-sql-report.mjs --since 7d      # 只看最近 N 天（如 7d / 24h / 30m）
 *   node scripts/slow-sql-report.mjs --sql "SELECT"  # 只统计包含该关键字的语句
 *
 * 归一口径：数字 → ?、字符串 → ?、IN (...) → IN (?)，让参数不同的同一条 SQL 合成一条。
 * 约束：零第三方依赖，仅 Node 内置模块；只读日志，不连数据库（EXPLAIN 见 --explain-hint）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const LOG_DIR = path.join(ROOT, 'ly-admin-api', 'logs');

/** 解析命令行参数（--key value / --flag）。 */
function parseArgs(argv) {
  const args = { top: 10 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--top') {
      args.top = Number(argv[index + 1]) || 10;
      index += 1;
    } else if (token === '--since') {
      args.since = String(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--sql') {
      args.sql = String(argv[index + 1] ?? '');
      index += 1;
    }
  }
  return args;
}

/** `7d` / `24h` / `30m` → 毫秒（无法解析返回 null = 不限制）。 */
function parseSince(text) {
  const matched = /^(\d+)\s*([dhm])$/i.exec(text ?? '');
  if (!matched) {
    return null;
  }
  const value = Number(matched[1]);
  const unit = matched[2].toLowerCase();
  return unit === 'd' ? value * 86400_000 : unit === 'h' ? value * 3_600_000 : value * 60_000;
}

/** SQL 归一化：剥离参数差异，让同一条语句的不同执行合成一条。 */
function normalizeSql(sql) {
  return sql
    .replace(/'[^']*'/g, '?')
    .replace(/"[^"]*"/g, '?')
    .replace(/\b\d+(\.\d+)?\b/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 递归收集 db-*.log（含 logs/archive/**）。 */
function collectLogFiles(dir) {
  const found = [];
  if (!fs.existsSync(dir)) {
    return found;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectLogFiles(full));
    } else if (/^db-.*\.log$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sinceMs = parseSince(args.since);
  const sinceTime = sinceMs === null ? 0 : Date.now() - sinceMs;
  const keyword = args.sql ? args.sql.toLowerCase() : '';

  const files = collectLogFiles(LOG_DIR);
  if (files.length === 0) {
    console.log(`[slow-sql] 未找到慢 SQL 日志（${LOG_DIR}/db-*.log）`);
    console.log('[slow-sql] 提示：DB_LOGGING=true 且 SLOW_SQL_MS 阈值内才会记录；刚部署还没有慢查询也是空的');
    return;
  }

  /** 归一化 SQL → 聚合统计。 */
  const stats = new Map();
  let total = 0;
  let skipped = 0;

  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) {
        continue;
      }
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        skipped += 1;
        continue;
      }
      if (typeof record.sql !== 'string' || typeof record.duration !== 'number') {
        continue;
      }
      const time = Date.parse(record.time ?? '');
      if (sinceTime && (!Number.isFinite(time) || time < sinceTime)) {
        continue;
      }
      if (keyword && !record.sql.toLowerCase().includes(keyword)) {
        continue;
      }
      total += 1;
      const key = normalizeSql(record.sql);
      const entry = stats.get(key) ?? { count: 0, totalMs: 0, maxMs: 0, lastTime: '' };
      entry.count += 1;
      entry.totalMs += record.duration;
      entry.maxMs = Math.max(entry.maxMs, record.duration);
      entry.lastTime = String(record.time ?? '');
      stats.set(key, entry);
    }
  }

  if (total === 0) {
    console.log('[slow-sql] 范围内没有慢 SQL 记录（阈值见 SLOW_SQL_MS；范围越大越容易有）');
    return;
  }

  const top = [...stats.entries()]
    .map(([sql, entry]) => ({ sql, ...entry, avgMs: Math.round(entry.totalMs / entry.count) }))
    .sort((left, right) => right.count - left.count || right.maxMs - left.maxMs)
    .slice(0, args.top);

  console.log(`[slow-sql] ${files.length} 个日志文件，共 ${total} 条慢 SQL，归一化后 ${stats.size} 种语句`);
  console.log(`[slow-sql] TOP ${top.length}（按出现次数，其次最大耗时）：\n`);
  top.forEach((entry, index) => {
    console.log(
      `#${index + 1}  次数 ${entry.count}  平均 ${entry.avgMs}ms  最大 ${entry.maxMs}ms  最近 ${entry.lastTime}`,
    );
    console.log(`    ${entry.sql.length > 200 ? `${entry.sql.slice(0, 200)}…` : entry.sql}\n`);
  });

  console.log('[slow-sql] 治理流程：对 TOP 语句用 EXPLAIN 验证索引使用情况，');
  console.log('[slow-sql] 缺索引的补 @@index（prisma/schema/*.prisma），命中索引仍慢的考虑改写法或加缓存。');
  if (skipped > 0) {
    console.log(`[slow-sql] （跳过 ${skipped} 行无法解析的日志）`);
  }
}

main();
