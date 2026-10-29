#!/usr/bin/env node
/**
 * 将前端构建产物（`ly-admin-web/dist`）同步到后端同源托管目录。
 *
 * 背景：生产「同源部署」时前端产物由后端直接托管（`app.setup.ts` 从 `config.web.distDir`
 * 读取），该目录默认是 `<api 根>/web`。Docker 镜像构建用 `COPY --from=web-builder` 完成这一步，
 * 但**本地原生打包**此前需要手工复制，容易忘记导致后端托管到旧产物。本脚本把「打包 → 同步」
 * 收敛为一步，`npm run build` / `build:only` 结束即自动就位。**同时保留 `dist/`**（只读拷贝，
 * 不移动），本地预览 / 交给 nginx 时照旧可用。
 *
 * 目标目录解析**对齐后端** `config.web.distDir`（`path.resolve(ROOT_DIR, WEB_DIST_DIR ?? 'web')`）：
 * 优先取 shell 环境变量 `WEB_DIST_DIR`，其次读 `ly-admin-api/.env` 的同名项，最后回落默认 `web`，
 * 相对路径一律以 api 根为基准解析 —— 保证「脚本同步到哪，后端就从哪托管」两者永不漂移。
 *
 * 安全：目标目录会被**清空重建**（产物名带内容哈希，必须清掉旧文件避免无限累积），
 * 故对解析结果做白名单式校验，拒绝任何可能指到源码 / 仓库根 / 盘根的路径。
 *
 * 在镜像构建阶段（web-builder）不存在 `ly-admin-api` 目录，脚本会直接跳过并成功退出，
 * 不影响 Docker 构建（那一步交给 Dockerfile 的 COPY 负责）。
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(WEB_DIR, '..');
/** 构建产物源目录（Vite 的 build.outDir）。 */
const SRC_DIR = path.join(WEB_DIR, 'dist');
/** 后端项目根（等于后端 `ROOT_DIR`，`WEB_DIST_DIR` 相对此目录解析）。 */
const API_ROOT = path.join(REPO_ROOT, 'ly-admin-api');

/** 统一前缀输出，便于在构建日志里定位。 */
function log(message) {
  process.stdout.write(`[sync-web-dist] ${message}\n`);
}

/**
 * 从指定 .env 文件读取某个键（极简解析，与后端 `env-parse.ts` 口径一致）。
 * 文件不存在 / 不可读 / 无该键时返回 undefined。
 */
async function readEnvFromFile(envPath, key) {
  try {
    const content = await readFile(envPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const eq = line.indexOf('=');
      if (eq <= 0 || line.slice(0, eq).trim() !== key) {
        continue;
      }
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    // .env 缺失：交由调用方回落默认值
  }
  return undefined;
}

/** 解析目标目录（shell env > api/.env > 默认 web，相对路径以 api 根为基准）。 */
async function resolveTargetDir() {
  const fromShell = process.env.WEB_DIST_DIR?.trim();
  const fromEnvFile = fromShell ? undefined : await readEnvFromFile(path.join(API_ROOT, '.env'), 'WEB_DIST_DIR');
  const configured = (fromShell || fromEnvFile || '').trim();
  return path.resolve(API_ROOT, configured.length > 0 ? configured : 'web');
}

/**
 * 目标目录安全校验：清理前必须确认它不触碰任何受保护路径。
 * 拒绝「等于」源码 / 仓库根 / api 根 / 盘根，也拒绝「是它们的祖先」。
 */
function assertSafeTarget(target) {
  const forbidden = new Set([REPO_ROOT, API_ROOT, WEB_DIR, SRC_DIR, path.parse(target).root]);
  if (forbidden.has(target)) {
    throw new Error(`拒绝同步：目标目录解析为受保护路径 ${target}`);
  }
  for (const guarded of [REPO_ROOT, WEB_DIR, SRC_DIR]) {
    if (guarded === target || guarded.startsWith(`${target}${path.sep}`)) {
      throw new Error(`拒绝同步：目标目录 ${target} 是受保护路径 ${guarded} 的祖先`);
    }
  }
}

/** 递归统计文件数与总字节数（用于同步后的日志）。 */
async function summarize(dir) {
  let files = 0;
  let bytes = 0;
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        files += 1;
        bytes += (await readFile(full)).length;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    throw new Error(`未找到构建产物 ${SRC_DIR}，请先执行 vite build`);
  }
  if (!existsSync(API_ROOT)) {
    log('未找到 ly-admin-api 目录（如镜像构建阶段），跳过同步');
    return;
  }

  const target = await resolveTargetDir();
  assertSafeTarget(target);

  // 清空重建：产物文件名带内容哈希，必须删除旧文件否则历史资源无限累积
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(SRC_DIR, target, { recursive: true });

  const { files, bytes } = await summarize(target);
  log(`已同步 dist → ${target}（${files} 个文件，${(bytes / 1024 / 1024).toFixed(2)} MB）`);
}

main().catch((error) => {
  log(`同步失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
