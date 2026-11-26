/**
 * 构建信息（自动生成，请勿手工编辑）。
 *
 * 由 `scripts/build-info.mjs` 在构建期（prebuild）写入；
 * 环境变量 APP_VERSION / GIT_COMMIT 可覆盖对应字段（CI 发布用）。
 */
export const BUILD_INFO = {
  "version": "1.0.0",
  "commit": "b847ffdd53f37ace60007671611418792b7f782e",
  "shortCommit": "b847ffd",
  "branch": "main",
  "buildTime": "2026-11-26T15:48:56.812Z",
  "node": "v24.22.3"
} as const;

export type BuildInfo = typeof BUILD_INFO;
