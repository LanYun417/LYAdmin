import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

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
      open: false,
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
      chunkSizeWarningLimit: 3000,
    },
  };
});
