/**
 * 把 prisma/schema/ 目录下各 `.prisma` 文件里的文档注释（`///`）同步为 MySQL 的表注释与字段注释。
 *
 * 为什么需要它：Prisma 至今（7.x）不支持在 schema 里声明数据库 COMMENT——
 * `///` 只进 DMMF 与 Prisma Client 的 JSDoc，`prisma db push` 不会写库，
 * `prisma db pull` 也读不回来。而表/字段注释是运维与代码生成器的数据源
 * （gen 模块从 information_schema 读 TABLE_COMMENT / COLUMN_COMMENT 作为业务名与字段标签）。
 *
 * 用法：
 *   npm run prisma:comments          # 应用差异（默认）
 *   npm run prisma:comments:check    # 仅检查，有差异时退出码 1（可用于 CI）
 *   tsx scripts/prisma-comments.ts --dry-run   # 只打印将要执行的 SQL
 *   tsx scripts/prisma-comments.ts --prune     # 额外清空 schema 未声明的多余注释
 *
 * 特点：
 * - 幂等：先比对 information_schema 现状，只对差异发语句；
 * - 不破坏列定义：改列注释必须带完整列定义，这里从 `SHOW CREATE TABLE` 取 MySQL
 *   自己生成的原始定义、仅剥离原有 COMMENT，避免手拼类型/default/charset 出错；
 * - 默认只补充与修正，不主动清空数据库里多出来的注释（除非 --prune）；
 * - 与 db push 共存：db push 不感知注释，实测不会抹掉本脚本写入的注释；
 *   但 `db push --force-reset` 会重建表并丢失注释，重建后重新执行本脚本即可。
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { config } from '../src/common/config/config.js';

/**
 * schema 目录（目录式 schema：模型按域拆在同目录的多个 `.prisma` 文件里）。
 *
 * 解析前按文件名排序拼接成一个字符串即可 —— 解析器是逐行状态机，每个 model 块自洽，
 * 各文件开头的 `//` 注释行在 model 之外会被丢弃，不会把上一个文件的 `///` 误挂到下一个文件。
 */
const SCHEMA_DIR = 'prisma/schema';
const SCALARS = new Set(['BigInt', 'String', 'Int', 'Boolean', 'DateTime', 'Decimal', 'Json', 'Bytes', 'Float']);

const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--dry-run') ? 'dry' : 'apply';
const prune = process.argv.includes('--prune');

interface TableTarget {
  table: string;
  comment: string;
  columns: Map<string, string>;
}

interface ColumnState {
  /** 去掉 COMMENT 后的完整列定义（来自 SHOW CREATE TABLE） */
  def: string;
  comment: string;
}

/**
 * 读取 schema 目录下的全部 `.prisma` 文件，按文件名排序后拼接成一个字符串。
 * @throws Error 目录不存在或其中没有任何 .prisma 文件
 */
function readSchemaDir(): string {
  if (!fs.existsSync(SCHEMA_DIR)) {
    throw new Error(`未找到 schema 目录: ${SCHEMA_DIR}`);
  }
  const files = fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.prisma'))
    .sort();
  if (files.length === 0) {
    throw new Error(`schema 目录下没有 .prisma 文件: ${SCHEMA_DIR}`);
  }
  return files.map((name) => fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf-8')).join('\n');
}

/** 解析 schema：仅取标量字段（关系字段没有对应数据库列）。 */
function parseSchemaTargets(src: string): TableTarget[] {
  const tables: TableTarget[] = [];
  let cur: TableTarget | null = null;
  let doc: string[] = [];

  for (const raw of src.split('\n')) {
    const line = raw.trim();

    // 文档注释：可能属于紧随其后的 model（表注释）或字段（列注释），先累积
    if (line.startsWith('///')) {
      doc.push(line.replace(/^\/\/\/\s?/, ''));
      continue;
    }

    const mm = /^model\s+\w+\s*\{/.exec(line);
    if (mm) {
      cur = { table: '', comment: doc.join(' '), columns: new Map() };
      doc = [];
      continue;
    }

    if (line === '}') {
      if (cur) tables.push(cur);
      cur = null;
      doc = [];
      continue;
    }

    if (!cur) {
      doc = [];
      continue;
    }

    if (line.startsWith('//')) continue;

    const mt = /^@@map\("([^"]+)"\)/.exec(line);
    if (mt) {
      cur.table = mt[1];
      doc = [];
      continue;
    }
    if (line.startsWith('@@')) {
      doc = [];
      continue;
    }

    const fm = /^(\w+)\s+(\S+)/.exec(line);
    if (fm && !fm[2].endsWith('[]') && SCALARS.has(fm[2].replace(/[?[\]]/g, ''))) {
      const mc = /@map\("([^"]+)"\)/.exec(line);
      const col = mc ? mc[1] : fm[1];
      if (doc.length) cur.columns.set(col, doc.join(' '));
    }
    doc = [];
  }
  return tables.filter((t) => t.table);
}

/** 读取 SQL 字符串字面量，支持 `\\` 与 `''` 两种转义。 */
function readSqlLiteral(s: string, i: number): { value: string; end: number } {
  let j = i + 1;
  let value = '';
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') {
      value += s[j + 1] ?? '';
      j += 2;
      continue;
    }
    if (ch === "'") {
      if (s[j + 1] === "'") {
        value += "'";
        j += 2;
        continue;
      }
      return { value, end: j + 1 };
    }
    value += ch;
    j += 1;
  }
  return { value, end: j };
}

/** 从列定义里剥离 `COMMENT '...'`，返回剩余定义与原注释。 */
function stripComment(def: string): { def: string; comment: string } {
  let i = 0;
  while (i < def.length) {
    const ch = def[i];
    if (ch === "'") {
      i = readSqlLiteral(def, i).end;
      continue;
    }
    if (
      ch.toUpperCase() === 'C' &&
      def.slice(i, i + 7).toUpperCase() === 'COMMENT' &&
      /\s/.test(def[i - 1] ?? ' ') &&
      /\s/.test(def[i + 7] ?? ' ')
    ) {
      let j = i + 7;
      while (j < def.length && /\s/.test(def[j])) j += 1;
      const lit = readSqlLiteral(def, j);
      return { def: (def.slice(0, i) + def.slice(lit.end)).trim(), comment: lit.value };
    }
    i += 1;
  }
  return { def, comment: '' };
}

interface TableState {
  comment: string;
  columns: Map<string, ColumnState>;
}

/** 从 SHOW CREATE TABLE 解析出列定义与表注释。 */
function parseCreateTable(ddl: string): TableState {
  const columns = new Map<string, ColumnState>();
  for (const raw of ddl.split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    const m = /^`([^`]+)`\s+(.+)$/.exec(line);
    if (!m) continue;
    const stripped = stripComment(m[2]);
    columns.set(m[1], { def: stripped.def, comment: stripped.comment });
  }
  const tail = ddl.slice(ddl.lastIndexOf(')'));
  const tm = /COMMENT='((?:[^']|'')*)'/.exec(tail);
  return { comment: tm ? tm[1].replace(/''/g, "'") : '', columns };
}

const escapeSql = (v: string): string => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      connectionLimit: 2,
    }),
  });

  const targets = parseSchemaTargets(readSchemaDir());
  const existing = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    config.db.name,
  );
  const existingTables = new Set(existing.map((r) => r.TABLE_NAME));

  const statements: string[] = [];
  let tableChanges = 0;
  const extraComments: string[] = [];

  for (const t of targets) {
    if (!existingTables.has(t.table)) {
      console.log(`  · 跳过 ${t.table}（库中不存在，先执行 npm run prisma:push）`);
      continue;
    }
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(`SHOW CREATE TABLE \`${t.table}\``);
    const row = rows[0] ?? {};
    const ddl = row['Create Table'] ?? Object.values(row)[1] ?? '';
    const state = parseCreateTable(ddl);

    if (t.comment && state.comment !== t.comment) {
      statements.push(`ALTER TABLE \`${t.table}\` COMMENT = '${escapeSql(t.comment)}'`);
      tableChanges += 1;
    } else if (!t.comment && state.comment && prune) {
      statements.push(`ALTER TABLE \`${t.table}\` COMMENT = ''`);
      tableChanges += 1;
    } else if (!t.comment && state.comment) {
      extraComments.push(`${t.table}（表）`);
    }

    for (const [col, comment] of t.columns) {
      const current = state.columns.get(col);
      if (!current) {
        console.log(`  · 跳过 ${t.table}.${col}（库中不存在该列）`);
        continue;
      }
      if (current.comment === comment) continue;
      if (!comment && !prune) {
        if (current.comment) extraComments.push(`${t.table}.${col}`);
        continue;
      }
      statements.push(
        `ALTER TABLE \`${t.table}\` MODIFY COLUMN \`${col}\` ${current.def} COMMENT '${escapeSql(comment)}'`,
      );
    }
  }

  console.log(`表注释变更 ${tableChanges} 处，列注释变更 ${statements.length - tableChanges} 处`);
  if (extraComments.length) {
    console.log(
      `数据库中存在 schema 未声明的注释 ${extraComments.length} 处（默认保留，--prune 可清空）：${extraComments.slice(0, 5).join('、')}${extraComments.length > 5 ? ' …' : ''}`,
    );
  }

  if (!statements.length) {
    console.log('已是最新，无需变更 ✓');
    await prisma.$disconnect();
    return;
  }

  if (mode === 'check') {
    console.log('\n以下语句待应用（--check 模式不执行）：');
    for (const s of statements.slice(0, 10)) console.log('  ' + s);
    if (statements.length > 10) console.log(`  … 共 ${statements.length} 条`);
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  if (mode === 'dry') {
    for (const s of statements) console.log('  ' + s);
    await prisma.$disconnect();
    return;
  }

  for (const s of statements) await prisma.$executeRawUnsafe(s);
  console.log(`已应用 ${statements.length} 条语句 ✓`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error('同步失败：', error);
  process.exitCode = 1;
});
