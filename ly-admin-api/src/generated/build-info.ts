/**
 * 构建信息（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/build-info.mjs` 在构建期（prebuild）写入；
 * 环境变量 APP_VERSION / GIT_COMMIT 可覆盖对应字段（CI 发布用）。
 */
export const BUILD_INFO = {
  "version": "1.0.0",
  "commit": "5fa63479f21695a2691049895b1934b4b6782b25",
  "shortCommit": "5fa6347",
  "branch": "main",
  "buildTime": "2026-11-26T15:27:45.764Z",
  "node": "v24.22.3"
} as const;

export type BuildInfo = typeof BUILD_INFO;
