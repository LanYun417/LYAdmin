#!/usr/bin/env node
/**
 * 数据库备份：mysqldump → gzip → 保留期清理。
 *
 * 用法：
 *   node scripts/db-backup.mjs                    # 备份（默认输出 ly-admin-api/backups/）
 *   node scripts/db-backup.mjs --keep 14          # 覆盖保留份数（默认 7）
 *   node scripts/db-backup.mjs --list             # 只列已有备份，不执行
 *   node scripts/db-backup.mjs --dir <path>       # 覆盖输出目录
 *   node scripts/db-backup.mjs --verify [file]    # 恢复校验：解压导入临时库并核对表数
 *
 * 恢复校验（--verify）说明：
 * - 「备份文件存在」≠「备份可用」：截断的 gzip、缺库权限、字符集问题都只在恢复时才暴露。
 *   该模式把指定备份（默认最新一份）导入 `ly_admin_restore_check` 临时库，核对表数量后丢弃，
 *   以最小代价验证「这份备份真的能恢复」；
 * - 需要数据库账号有 CREATE/DROP 权限；校验用的临时库名固定，重复执行会先清理再建；
 * - 退出码：0 = 通过；1 = 失败（文件缺失 / 解压或导入失败 / 表数与线上不一致）。
 * 说明：
 * - 口令从 ly-admin-api/.env 读（DB_USER/DB_PASSWORD/DB_NAME/DB_HOST/DB_PORT），
 *   不在命令行传参（进程列表里 `--password=` 会明文泄露）；
 * - 依赖机器上有 mysqldump（与 MySQL 同源安装）；脚本本身零 npm 依赖，
 *   压缩用 Node 内置 zlib（产物 .sql.gz），保留期外的旧备份自动删除；
 * - 备份文件名带库名与时间戳：ly_admin-20261112-233000.sql.gz。
 * - 配套建议：配 crontab / 计划任务每日跑一次，保留份数按 RPO 定。
 */
import { execFile } from 'node:child_process';
import { createGunzip, createGzip } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const API_DIR = path.join(ROOT, 'ly-admin-api');
const DEFAULT_BACKUP_DIR = path.join(API_DIR, 'backups');

/** 解析命令行参数（--key value）。 */
function parseArgs(argv) {
  const args = { keep: 7, dir: DEFAULT_BACKUP_DIR, list: false, verify: false, verifyFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--keep') {
      args.keep = Math.max(1, Number(argv[index + 1]) || 7);
      index += 1;
    } else if (token === '--dir') {
      args.dir = path.resolve(String(argv[index + 1] ?? DEFAULT_BACKUP_DIR));
      index += 1;
    } else if (token === '--list') {
      args.list = true;
    } else if (token === '--verify') {
      args.verify = true;
      // --verify [file]：file 可省略（取最新一份），也可显式指定
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        args.verifyFile = next;
        index += 1;
      }
    }
  }
  return args;
}

/** 执行 mysql 客户端命令（口令走 MYSQL_PWD，不进命令行），返回 stdout。 */
function runMysql(config, sql) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'mysql',
      ['-h', config.host, '-P', String(config.port), '-u', config.user, config.database, '-e', sql],
      { env: { ...process.env, MYSQL_PWD: config.password }, maxBuffer: 16 * 1024 * 1024 },
    );
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        reject(new Error('找不到 mysql 客户端：请确认 MySQL 客户端已安装并在 PATH 中'));
        return;
      }
      reject(error);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`mysql 退出码 ${code}`));
    });
  });
}

/** 查询库的表数量（SHOW TABLES 行数）。 */
async function countTables(config) {
  const stdout = await runMysql(config, 'SHOW TABLES;');
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

/**
 * 恢复校验：把备份导入临时库并核对表数。
 *
 * 一次性临时库名固定为 `<库名>_restore_check`：重复校验会先 DROP 再 CREATE，
 * 避免历史残留把「旧备份」误判成通过。
 */
async function verifyBackup(args, config) {
  const backups = listBackups(args.dir);
  if (backups.length === 0) {
    console.error(`[db-backup] ${args.dir} 下没有可校验的备份`);
    process.exit(1);
  }
  const chosen = args.verifyFile
    ? (backups.find((backup) => backup.name === args.verifyFile) ?? {
        name: args.verifyFile,
        bytes: 0,
        mtime: new Date(),
      })
    : backups[0];
  const file = path.isAbsolute(chosen.name) ? chosen.name : path.join(args.dir, chosen.name);
  if (!fs.existsSync(file)) {
    console.error(`[db-backup] 备份文件不存在：${file}`);
    process.exit(1);
  }

  const checkDatabase = `${config.database}_restore_check`;
  const startedAt = Date.now();
  console.log(`[db-backup] 恢复校验 ${file} → 临时库 ${checkDatabase}`);
  try {
    await runMysql(
      config,
      `DROP DATABASE IF EXISTS \`${checkDatabase}\`; CREATE DATABASE \`${checkDatabase}\` CHARACTER SET utf8mb4;`,
    );
    await new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const child = execFile(
        'mysql',
        ['-h', config.host, '-P', String(config.port), '-u', config.user, checkDatabase],
        { env: { ...process.env, MYSQL_PWD: config.password } },
      );
      const stream = fs.createReadStream(file);
      void stream.pipe(gunzip).pipe(child.stdin);
      let settled = false;
      const settle = (error) => {
        if (settled) return;
        settled = true;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      child.on('error', settle);
      child.on('exit', (code) => {
        // 退出码 0 才算导入成功；管道 finish 只代表数据写完，导入可能仍在进行
        settle(code === 0 ? undefined : new Error(`导入退出码 ${code ?? 'unknown'}`));
      });
      stream.on('error', settle);
      gunzip.on('error', settle);
      // 兜底超时：避免 mysql 挂起把校验流程卡死
      setTimeout(() => settle(new Error('导入超时（120s）')), 120_000);
    });
    const restored = await countTables({ ...config, database: checkDatabase });
    const live = await countTables(config);
    if (restored <= 0) {
      throw new Error('临时库中没有表，备份可能为空或已损坏');
    }
    if (live > 0 && restored !== live) {
      throw new Error(`表数不一致：备份 ${restored} 张 vs 线上 ${live} 张（备份可能早于结构变更）`);
    }
    console.log(
      `[db-backup] ✅ 校验通过：备份可恢复，共 ${restored} 张表（线上 ${live} 张），用时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
  } catch (error) {
    console.error(`[db-backup] ❌ 校验失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await runMysql(config, `DROP DATABASE IF EXISTS \`${checkDatabase}\`;`).catch(() => undefined);
  }
}

/** 读取 ly-admin-api/.env 的键值（不做任何转义，仅取我们需要的几个键）。 */
function readDbConfig() {
  const envPath = path.join(API_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`[db-backup] 未找到 ${envPath}（备份需要库连接信息）`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const matched = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (matched) {
      env[matched[1]] = matched[2].replace(/^["']|["']$/g, '');
    }
  }
  const config = {
    host: env.DB_HOST || '127.0.0.1',
    port: env.DB_PORT || '3306',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME || 'ly_admin',
  };
  if (!config.database) {
    console.error('[db-backup] DB_NAME 未配置');
    process.exit(1);
  }
  return config;
}

/** 执行 mysqldump，stdout 经 gzip 写入目标文件。 */
function runDump(config, target) {
  const args = [
    '-h',
    config.host,
    '-P',
    String(config.port),
    '-u',
    config.user,
    '--single-transaction',
    '--quick',
    '--default-character-set=utf8mb4',
    '--routines',
    '--triggers',
    '--events',
    config.database,
  ];
  // 口令走环境变量，不进命令行
  const child = execFile('mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: config.password },
  });

  const out = fs.createWriteStream(target);
  const gzip = createGzip();

  return new Promise((resolve, reject) => {
    // ⚠️ 必须等 pipeline 完成再 resolve：进程 exit 只代表 mysqldump 退出，
    // 此时 stdout → gzip → 文件的数据可能还没落盘；提前 end 会把文件截断成
    // 只有 gzip 头的 10 字节空包（2026-11-12 真实踩坑）。
    let exitCode = 0;
    const piped = child.stdout ? pipeline(child.stdout, gzip, out) : Promise.reject(new Error('stdout 不可用'));
    child.on('error', (error) => {
      out.destroy();
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        reject(new Error('找不到 mysqldump：请确认 MySQL 客户端已安装并在 PATH 中'));
        return;
      }
      reject(error);
    });
    child.on('exit', (code) => {
      exitCode = code ?? 1;
    });
    piped
      .then(() => {
        if (exitCode === 0) {
          resolve();
          return;
        }
        reject(new Error(`mysqldump 退出码 ${exitCode}`));
      })
      .catch(reject);
  });
}

/** 列已有备份（新→旧）。 */
function listBackups(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => /\.sql\.gz$/.test(name))
    .map((name) => ({
      name,
      bytes: fs.statSync(path.join(dir, name)).size,
      mtime: fs.statSync(path.join(dir, name)).mtime,
    }))
    .sort((left, right) => right.mtime.getTime() - left.mtime.getTime());
}

/** 保留最近 keep 份，其余删除（返回删除条数）。 */
function pruneBackups(dir, keep) {
  const backups = listBackups(dir);
  const removed = backups.slice(keep);
  for (const backup of removed) {
    fs.rmSync(path.join(dir, backup.name), { force: true });
  }
  return removed.length;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.verify) {
    verifyBackup(args, readDbConfig());
    return;
  }

  if (args.list) {
    const backups = listBackups(args.dir);
    if (backups.length === 0) {
      console.log(`[db-backup] ${args.dir} 下暂无备份`);
      return;
    }
    console.log(`[db-backup] ${args.dir} 共 ${backups.length} 份：`);
    for (const backup of backups) {
      const size = `${(backup.bytes / 1024 / 1024).toFixed(2)}MB`;
      console.log(
        `  ${backup.mtime.toISOString().replace('T', ' ').slice(0, 19)}  ${size.padStart(10)}  ${backup.name}`,
      );
    }
    return;
  }

  const config = readDbConfig();
  fs.mkdirSync(args.dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const target = path.join(args.dir, `${config.database}-${stamp}.sql.gz`);

  console.log(`[db-backup] 备份 ${config.database}@${config.host}:${config.port} → ${target}`);
  const startedAt = Date.now();
  runDump(config, target)
    .then(() => {
      const bytes = fs.statSync(target).size;
      if (bytes < 1024) {
        console.error(`[db-backup] ❌ 备份文件异常小（${bytes} 字节），可能失败了`);
        process.exit(1);
      }
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[db-backup] ✅ 完成 ${(bytes / 1024 / 1024).toFixed(2)}MB，用时 ${seconds}s`);
      const pruned = pruneBackups(args.dir, args.keep);
      if (pruned > 0) {
        console.log(`[db-backup] 已清理 ${pruned} 份超出保留期（--keep ${args.keep}）的旧备份`);
      }
    })
    .catch((error) => {
      fs.rmSync(target, { force: true });
      console.error(`[db-backup] ❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}

main();
