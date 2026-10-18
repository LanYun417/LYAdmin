/**
 * lint-staged 配置：对暂存区文件按类型分派 lint / format。
 *
 * Windows 适配（重要）：暂存文件量大时（典型场景：目录更名一次性带入数百个文件），
 * 把全部路径拼进单条命令会超出 Windows CreateProcess 约 32KB 的命令行上限，
 * 报「参数太长」导致 pre-commit 失败。因此本配置：
 *   1) 先用函数语法过滤掉供应商资源与生成产物（Vditor、Prisma 生成客户端、
 *      自动导入声明等，范围与 .prettierignore / eslint ignores 保持一致），
 *      工具根本不会收到它们——既避免 eslint 的 "File ignored" 警告，也缩短参数；
 *   2) 再把剩余文件按 CHUNK 大小切批，逐批执行，保证任意批次都不超限。
 */
const picomatch = require('picomatch');

/** 不参与 lint / format 的供应商资源与生成产物。
 *
 * ⚠️ 模式必须以通配目录前缀（两个星号 + 斜杠）开头：lint-staged 传给任务函数的是
 * 绝对路径（如 C:/Users/x/ly-admin/ly-admin-api/src/generated/prisma/models/User.ts），
 * 若按仓库相对路径书写（ly-admin-api/src/generated 这种形式）将永远匹配不上、静默失效。
 */
const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**',
  '**/build/**',
  '**/coverage/**',
  // Vditor 自托管供应商静态资源（保持上游原样）
  '**/ly-admin-web/public/vditor/**',
  // 前端自动生成的类型声明（格式由 unplugin 插件决定）
  '**/ly-admin-web/auto-imports.d.ts',
  '**/ly-admin-web/components.d.ts',
  // Prisma 生成客户端（构建产物）
  '**/ly-admin-api/src/generated/**',
  // 接口文档数据（由 scripts/gen-api-docs.mjs 生成）
  '**/ly-admin-api/src/modules/docs/api-docs.generated.ts',
  '**/ly-admin-api/src/modules/docs/openapi.generated.ts',
  // 运行时数据目录
  '**/ly-admin-api/uploads/**',
  '**/ly-admin-api/logs/**',
  '**/ly-admin-api/cache/**',
];

/** 单批最大文件数（经验值：40 条路径 × 最长约 120 字符 ≈ 5KB，远低于 32KB 上限）。 */
const CHUNK_SIZE = 40;

const isIgnored = picomatch(IGNORED_PATTERNS, { dot: true });

/** 过滤忽略项并切批，返回每批的命令行文件参数字符串。 */
function toBatches(files) {
  const kept = files.filter((file) => !isIgnored(file));
  const batches = [];
  for (let index = 0; index < kept.length; index += CHUNK_SIZE) {
    batches.push(kept.slice(index, index + CHUNK_SIZE).join(' '));
  }
  return batches;
}

module.exports = {
  '*.{js,mjs,cjs,ts,vue}': (files) => [
    ...toBatches(files).map((batch) => `eslint --fix ${batch}`),
    ...toBatches(files).map((batch) => `prettier --write ${batch}`),
  ],
  '*.{json,css,scss,md,html,yml,yaml}': (files) => toBatches(files).map((batch) => `prettier --write ${batch}`),
  '*.{css,scss,vue}': (files) => toBatches(files).map((batch) => `stylelint --fix --allow-empty-input ${batch}`),
};
