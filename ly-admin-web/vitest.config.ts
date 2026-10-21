import { fileURLToPath, URL } from 'node:url';

import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * 把样式文件（.css/.scss/.sass/.less）解析为空模块。
 * 业务层通过 `@/utils/element` 以副作用方式引入 element-plus 的样式，
 * 单元测试不需要真实样式，避免 vitest 报「Unknown file extension ".css"」。
 */
function stubStyleImports(): Plugin {
  const CSS_RE = /\.(css|scss|sass|less|styl)$/;
  return {
    name: 'vitest-stub-style-imports',
    enforce: 'pre',
    resolveId(id) {
      if (CSS_RE.test(id)) return `\0stub-style:${id}`;
      return null;
    },
    load(id) {
      if (id.startsWith('\0stub-style:')) return 'export default {}';
      return null;
    },
  };
}

/**
 * 前端单元测试配置（Vitest）。
 *
 * 设计要点：
 * - 复用与 vite.config 一致的 AutoImport（`vue` / `vue-router` / `pinia` / `@vueuse/core`），
 *   这样 store / 工具文件中「自动引入」的 `ref`、`computed`、`defineStore` 等全局符号
 *   在测试里也能正常解析，无需逐个改造成显式 import。
 * - 路径别名 `@` → `src`，与 tsconfig、vite 配置保持一致。
 * - 默认环境 `jsdom`：权限判定等用例需要 `localStorage`（Token 读写）与可挂载的 Pinia。
 * - 纯 WebCrypto 用例（sha256Hex）在文件顶部用 `// @vitest-environment node`
 *   切到 node 环境，直接拿到 Node 原生 `crypto.subtle`，无 jsdom 兼容性问题。
 * - 仅覆盖「纯函数 / 逻辑」用例；Vue 组件渲染测试后续按需补充。
 */
export default defineConfig({
  plugins: [
    stubStyleImports(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: false,
      eslintrc: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    // Pinia / Day.js 等模块已自带浏览器/ node 兼容实现，无需额外 mock。
    css: false,
  },
});
