import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e 用例共享同一套真实 MySQL / Redis：每个 spec 都会完整启动一次 AppModule
    // （启动即跑幂等种子）。并行跑会并发写种子、互相干扰统计口径，故串行执行。
    fileParallelism: false,
  },
});
