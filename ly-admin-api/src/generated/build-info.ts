/**
 * 构建信息（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/build-info.mjs` 在构建期（prebuild）写入；
 * 环境变量 APP_VERSION / GIT_COMMIT 可覆盖对应字段（CI 发布用）。
 */
export const BUILD_INFO = {
  "version": "1.0.0",
  "commit": "8f612051e5a9bbe867a0b6336151f839e3b1814d",
  "shortCommit": "8f61205",
  "branch": "main",
  "buildTime": "2026-11-27T02:16:13.162Z",
  "node": "v24.22.3"
} as const;

export type BuildInfo = typeof BUILD_INFO;
