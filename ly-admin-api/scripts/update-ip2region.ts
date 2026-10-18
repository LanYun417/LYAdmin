/**
 * ip2region 数据文件（xdb）下载 / 更新脚本。
 *
 * 模块职责：从 ip2region 官方仓库拉取最新的 IPv4 xdb 数据文件到 `data/` 目录。
 * 该文件约 10MB 且更新频繁，故**不入库**（.gitignore 已排除），
 * 全新 clone 的项目或需要刷新 IP 库时执行一次 `npm run ip2region:update` 即可。
 *
 * 实现要点：先下载到临时文件再原子改名，避免中途失败留下损坏的半成品文件；
 * 下载完成后做最基本的完整性校验（文件头前 2 字节为 version，小端 uint16，
 * xdb 2.0 应为 2，与 ip2region.js 的 XdbStructure20 对应）。
 *
 * 用法：`npm run ip2region:update`
 */
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'ip2region_v4.xdb');

/** ip2region 官方仓库 master 分支的 IPv4 xdb 数据文件。 */
const DB_URL = 'https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb';

/** xdb 2.0 的 version 字段值（文件头前 2 字节，小端 uint16）。 */
const XDB_STRUCTURE_20 = 0x02;

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;

  process.stdout.write(`下载 ip2region xdb: ${DB_URL}\n`);
  const response = await fetch(DB_URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('下载失败：响应体为空');
  }
  await pipeline(response.body, createWriteStream(tmpFile));

  // 完整性校验：读取文件头 version 字段（前 2 字节，小端 uint16），确认是 xdb 2.0 结构
  const handle = await open(tmpFile, 'r');
  try {
    const head = Buffer.alloc(2);
    await handle.read(head, 0, 2, 0);
    if (head.readUInt16LE(0) !== XDB_STRUCTURE_20) {
      throw new Error(`文件头校验失败：${head.toString('hex')}，不是有效的 xdb 2.0 数据文件`);
    }
  } finally {
    await handle.close();
  }

  await rename(tmpFile, DB_FILE);
  const { size } = await stat(DB_FILE);
  process.stdout.write(`完成：${DB_FILE}（${(size / 1024 / 1024).toFixed(2)} MB）\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`ip2region 数据文件更新失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
