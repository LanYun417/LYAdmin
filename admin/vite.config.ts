import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { compression } from 'vite-plugin-compression2';

/**
 * Vite 配置。
 *
 * 关键点：
 * - 路径别名 `@` → `src`
 * - dev server 固定 5173 端口，代理 `/api`、`/uploads` 到后端 `http://localhost:3000`
 * - Element Plus 按需引入（unplugin-auto-import + unplugin-vue-components）
 * - `auto-imports.d.ts` / `components.d.ts` 生成于项目根，供 tsconfig include，须纳入版本管理
 */
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
      // 构建期预压缩：同时产出 .gz（gzip）与 .br（brotli）副本，零运行时开销。
      // 原文件一并保留（deleteOriginalAssets=false），兼容未配置预压缩的静态服务器。
      // 部署侧需开启预压缩读取才能真正受益：
      //   Nginx：http { gzip_static on; brotli_static on; }（需 ngx_brotli 模块）
      //   或直接用 Nginx 实时压缩：gzip on; gzip_types text/javascript application/javascript application/json text/css;
      // 若当前「后端托管 dist」的 Express 直接静态托管，需额外加预压缩静态处理器才能命中 .gz/.br。
      compression({
        algorithms: ['gzip', 'brotliCompress'],
        include: /\.(js|mjs|json|css|html|svg)$/i,
        exclude: /\.(png|jpe?g|gif|webp|avif|woff2?|ttf|eot|mp4|webm|ogg)$/i,
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: 'localhost',
      port: Number(env.VITE_PORT) || 5173,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // 超大 chunk 告警阈值：调低至 600 kB，避免全量图标库 / 全量 echarts 等超大 chunk 被静默放行
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          /**
           * 稳定的第三方 vendor chunk 拆分：把体积大、几乎不随业务改动的基础库单独成块，
           * 提升浏览器长缓存命中率（业务代码发布时不必让整包 vendor 失效）。
           * - echarts（+zrender）：图表，体量最大，独立成块
           * - vditor：富文本编辑器，独立成块
           * - element-plus：UI 组件库，独立成块
           * - vue-vendor：vue / vue-router / pinia / @vueuse 等核心运行时，独立成块
           * - vendor：其余 node_modules（floating-ui、dayjs、lodash 等稳定小依赖）兜底
           */
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](echarts|zrender)[\\/]/.test(id)) return 'echarts';
            if (/[\\/]node_modules[\\/]vditor[\\/]/.test(id)) return 'vditor';
            if (/[\\/]node_modules[\\/]element-plus[\\/]/.test(id)) return 'element-plus';
            if (/[\\/]node_modules[\\/](vue|vue-router|pinia|@vueuse|@vue|vue-demi)[\\/]/.test(id)) {
              return 'vue-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
