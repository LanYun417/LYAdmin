/**
 * 种子数据 CLI 入口（`npm run seed`）。
 * 模块职责：仅负责装配 Prisma 连接并调用 `runSeed`，业务逻辑全部在
 * `src/prisma/seed.service.ts`，与「服务启动时自动种子」共用同一份实现，避免两份数据漂移。
 *
 * 注意：本文件不参与 `nest build`（tsconfig.build.json 只编译 src/），
 * 仅通过 `tsx prisma/seed.ts` 运行；但会被根 tsconfig 的 `tsc --noEmit` 一并类型检查。
 */
import { runSeed } from '../src/prisma/seed.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const prisma = new PrismaService();

try {
  await prisma.$connect();
  await runSeed(prisma);
} catch (error) {
  console.error('[Seed] 执行失败:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
