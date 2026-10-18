import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 解析 tsconfig.json 中声明的路径别名（含 `nest g library` 生成的库条目）；
  // 该选项由 Vite 8 提供（当前版本已支持）
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
