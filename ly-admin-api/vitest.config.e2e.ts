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
    /**
     * 关闭接口限流：限流按 IP + 固定窗口计数，Redis 是**跨进程持久**的，
     * 同一分钟里反复跑 e2e（或与本地手工调试叠加）会把登录接口的 20 次/分钟额度耗尽，
     * 表现为随机的 429 假失败。限流逻辑本身有专门的单测（test/rate-limit.spec.ts），
     * 不依赖 e2e 覆盖。
     */
    env: { RATE_LIMIT_ENABLED: 'false' },
  },
});
