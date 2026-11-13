/**
 * ip2region 数据文件（xdb）下载 / 更新脚本。
 *
 * 模块职责：从 ip2region 官方仓库拉取最新的 IPv4 xdb 数据文件到 `data/` 目录。
 * 该文件约 10MB 且更新频繁，故**不入库**（.gitignore 已排除），
 * 全新 clone 的项目或需要刷新 IP 库时执行一次 `npm run ip2region:update` 即可。
 *
 * 实现要点：先下载到临时文件再原子改名，避免中途失败留下损坏的半成品文件；
 * 下载完成后做最基本的完整性校验（文件头前 2 字节为 version，小端 uint16），
 * 接受 v2(0x02) / v3(0x03)，与运行时 ip2region.js 的 loadContentFromFile 支持范围一致。
 *
 * 下载源：默认按候选列表依次尝试（jsDelivr 国内 CDN 优先，raw.githubusercontent 作兜底——
 * 后者在国内直连常被墙，Node 的 fetch 又不自动走系统代理，故不要把它当唯一源）；
 * 也可用环境变量 `IP2REGION_URL` 指定单个自定义源（如内网镜像 / 本地代理地址）。
 *
 * 用法：`npm run ip2region:update`
 * 自定义源：`IP2REGION_URL=https://example.com/ip2region_v4.xdb npm run ip2region:update`
 */
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'ip2region_v4.xdb');

/**
 * 候选下载源，按顺序尝试，全部失败才报错。
 * - jsDelivr 镜像国内可直连；
 * - raw.githubusercontent.com 为官方源，海外 / 配置了代理的环境可用。
 */
const DB_URLS = [
  'https://cdn.jsdelivr.net/gh/lionsoul2014/ip2region@master/data/ip2region_v4.xdb',
  'https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb',
];

/**
 * 合法的 xdb 结构版本（文件头前 2 字节，小端 uint16）。
 * 与运行时 ip2region.js 的 loadContentFromFile 一致：支持 v2(0x02) 与 v3(0x03)。
 */
const XDB_STRUCTURE_VERSIONS = new Set([0x02, 0x03]);

/** 依次尝试候选源下载到临时文件；每源失败清理临时文件后试下一源。 */
async function download(urls: string[], tmpFile: string): Promise<string> {
  let lastError: unknown = new Error('无可用下载源');
  for (const url of urls) {
    try {
      process.stdout.write(`下载 ip2region xdb: ${url}\n`);
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('响应体为空');
      }
      await pipeline(response.body, createWriteStream(tmpFile));
      return url;
    } catch (error) {
      lastError = error;
      await unlink(tmpFile).catch(() => undefined);
      process.stderr.write(
        `该源失败（${url}）：${error instanceof Error ? error.message : String(error)}，尝试下一源\n`,
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  // IP2REGION_URL 可覆盖为单个自定义源（内网镜像 / 本地代理等）
  const urls = process.env.IP2REGION_URL ? [process.env.IP2REGION_URL] : DB_URLS;

  await download(urls, tmpFile);

  // 完整性校验：读取文件头 version 字段（前 2 字节，小端 uint16），确认是合法 xdb 结构（v2/v3）
  const handle = await open(tmpFile, 'r');
  try {
    const head = Buffer.alloc(2);
    await handle.read(head, 0, 2, 0);
    const version = head.readUInt16LE(0);
    if (!XDB_STRUCTURE_VERSIONS.has(version)) {
      throw new Error(`文件头校验失败：version=${version}（${head.toString('hex')}），不是有效的 xdb 数据文件`);
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
