#!/usr/bin/env node
/**
 * 构建信息生成器。
 * 模块职责：把当前 Git 提交与构建时间写成 `src/generated/build-info.ts`，
 * 供运行期健康检查 / 监控页读取——回答「线上到底跑的哪个版本」。
 *
 * 背景：此前版本号只能靠人工注入环境变量 APP_VERSION / GIT_COMMIT，实际部署
 * （pm2、裸机）几乎没人配，健康检查长期返回 `version: "dev", commit: ""`，
 * 出问题时无法判断线上代码新旧。构建期自动落盘后排一次pipelline即可自证。
 *
 * 优先级：环境变量 > git 实际值 > 兜底 'dev' / ''。
 * 无 .git 的环境（如从源码包解构构建）自动降级，不阻断构建。
 *
 * 用法：`pnpm run build:info`（已接入 `prebuild`）。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(API_ROOT, 'src', 'generated', 'build-info.ts');

/** 执行 git 命令，失败返回 null（无 git / 非仓库目录时降级）。 */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: API_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const commit = git(['rev-parse', 'HEAD']) ?? '';
const shortCommit = commit ? (git(['rev-parse', '--short', 'HEAD']) ?? '') : '';
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '';

const pkg = JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf8'));

const buildInfo = {
  version: process.env.APP_VERSION || pkg.version || '1.0.0',
  commit,
  shortCommit,
  branch,
  /** 构建时间（本地时区 ISO）；运行时配合 uptime 可判断「构建于何时、跑了多久」。 */
  buildTime: new Date().toISOString(),
  node: process.version,
};

const source = `/**
 * 构建信息（自动生成，请勿手工编辑）。
 *
 * 由 \`scripts/build-info.mjs\` 在构建期（prebuild）写入；
 * 环境变量 APP_VERSION / GIT_COMMIT 可覆盖对应字段（CI 发布用）。
 */
export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;

export type BuildInfo = typeof BUILD_INFO;
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, source, 'utf8');
console.log(
  `[build-info] ${buildInfo.version} @ ${buildInfo.shortCommit || '(无 git)'} ${buildInfo.buildTime} → ${OUT_FILE}`,
);
