# 04 - Vite 配置详解

完整配置见 `ly-admin-web/vite.config.ts`。核心结构：

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        resolvers: [ElementPlusResolver()],
        dts: 'auto-imports.d.ts',
        eslintrc: { enabled: false },
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dirs: ['src/components'],
        extensions: ['vue'],
        deep: true,
        dts: 'components.d.ts',
      }),
      compression({
        algorithms: ['gzip', 'brotliCompress'],
        include: /\.(js|mjs|json|css|html|svg)$/i,
        exclude: /\.(png|jpe?g|gif|webp|avif|woff2?|ttf|eot|mp4|webm|ogg)$/i,
        threshold: 1024,
      }),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: 'localhost',
      port: Number(env.VITE_PORT) || 5173,
      strictPort: true,
      open: true,
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/static': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            /* echarts / vditor / element-plus / vue-vendor / vendor 拆分 */
          },
        },
      },
    },
  };
});
```

## 关键段落说明

### 1. 插件顺序

`vue()` 必须在前，`AutoImport` / `Components` 在后（自动导入插件需在 SFC 编译流程中注入 import 语句）。

### 2. 别名

```ts
'@': fileURLToPath(new URL('./src', import.meta.url))
```

ESM 标准写法，避免 `__dirname`（ESM 中不存在）。该别名必须与 `tsconfig.json` 的 `paths`（`"@/*": ["./src/*"]`）保持一致，否则 TS 报错但 Vite 能跑（或反之）。

### 3. 代理

`/api`、`/static` 代理到后端（默认 `http://localhost:3000`，以 `vite.config.ts` 中 `proxy.target` 为准）。与 `src/api/request.ts` 的 `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'` 对应；生产环境通过 `VITE_API_BASE_URL` 环境变量覆盖。

> `strictPort: true`：端口被占用会直接报错，而非自动切到 +1 端口。改端口需同步 `ly-admin-api/.env` 的 `PORT` 与 `VITE_PORT`。

### 4. 自动导入 d.ts 落点

`dts: 'auto-imports.d.ts'` / `'components.d.ts'` 生成在 `ly-admin-web/` **根目录**（非 `src/types`），与 `tsconfig.json` 的 `include`（`auto-imports.d.ts`、`components.d.ts`）对齐，并被 `eslint.config.mjs` 显式忽略。

### 5. 构建期预压缩

`vite-plugin-compression2` 同时产出 `.gz` / `.br`，原文件保留（`deleteOriginalAssets: false`），兼容未配置预压缩的静态服务器。部署侧需开启预压缩读取才能真正受益（Nginx `gzip_static on; brotli_static on;`）。

### 6. vendor 拆分

`manualChunks` 把 `echarts` / `vditor` / `element-plus` / 核心运行时（vue/vue-router/pinia/@vueuse）单独成块，提升浏览器长缓存命中；`chunkSizeWarningLimit` 调低至 600 kB，避免超大 chunk 被静默放行。

### 7. 产物同步到后端托管目录（同源部署）

生产「同源部署」时后端从 `config.web.distDir`（默认 `ly-admin-api/web`，可用 `WEB_DIST_DIR` 覆盖）托管前端产物。构建脚本 `npm run build` / `build:only` 结束会**自动**调用 `ly-admin-web/scripts/sync-web-dist.mjs`，把 `dist/` **只读拷贝**（清空重建）到该目录，**同时保留 `ly-admin-web/dist/` 本身**（本地 `preview` / 交给 Nginx 时照旧可用）。

- **目标目录解析对齐后端**：shell 环境变量 `WEB_DIST_DIR` > `ly-admin-api/.env` 的 `WEB_DIST_DIR` > 默认 `web`，相对路径一律以 `ly-admin-api/` 为基准 —— 保证「脚本同步到哪 = 后端从哪托管」，两者永不漂移。
- **清空重建**：产物文件名带内容哈希，必须删旧文件否则历史资源无限累积；故脚本对解析结果做白名单校验，拒绝任何指向源码 / 仓库根 / 盘根的路径。
- **镜像构建阶段自动跳过**：Dockerfile 的 web-builder 阶段不存在 `ly-admin-api/`，脚本直接跳过并成功退出（那一步由 Dockerfile 的 `COPY --from=web-builder` 负责）。
- 单独重同步：`npm --prefix ly-admin-web run sync:api`。

## 最佳实践

1. 环境变量一律 `VITE_` 前缀，类型在 `src/vite-env.d.ts` 中声明（如有需要）。
2. 不在 `vite.config.ts` 中写业务逻辑，只放构建配置。
3. 端口、代理等团队统一后不要随意改动，避免联调混乱。

## 常见错误

| 现象                       | 原因                                | 解决                               |
| -------------------------- | ----------------------------------- | ---------------------------------- |
| `Cannot find module '@'`   | vite alias 与 tsconfig paths 不一致 | 双端对齐为 `./src` / `src/*`       |
| 接口 404                   | 代理未生效或 target 端口错          | 检查 `proxy.target` 与后端 `PORT`  |
| `__dirname is not defined` | ESM 中使用 `__dirname`              | 改用 `fileURLToPath(new URL(...))` |
