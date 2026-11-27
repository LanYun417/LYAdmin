/**
 * 构建信息（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/build-info.mjs` 在构建期（prebuild）写入；
 * 环境变量 APP_VERSION / GIT_COMMIT 可覆盖对应字段（CI 发布用）。
 */
export const BUILD_INFO = {
  "version": "1.0.0",
  "commit": "edb1f3baa1f74101f135d3e6b22f42c079c27c84",
  "shortCommit": "edb1f3b",
  "branch": "main",
  "buildTime": "2026-11-27T09:54:33.755Z",
  "node": "v24.22.3"
} as const;

export type BuildInfo = typeof BUILD_INFO;
