/**
 * e2e 测试的应用装配助手。
 *
 * 与 `src/main.ts` 共用 `configureApp`，并显式 new 同一个 `OkExpressAdapter` ——
 * 保证「测的装配」＝「跑的装配」。否则全局校验管道缺失、POST 会回 201，
 * 校验文案与状态码类契约断言在测试里根本立不住。
 *
 * 不挂载静态资源（`serveStatic` 默认关闭）：单测无需，也避免依赖 uploads / 前端产物目录。
 */
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { OkExpressAdapter } from '../src/common/ok-express.adapter.js';

/**
 * 创建与生产口径一致的测试实例（需本地 MySQL 与 Redis 可用）。
 * @returns 已 init 的 Nest 应用（把 `app.getHttpServer()` 交给 supertest）
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>(new OkExpressAdapter());
  configureApp(app);
  await app.init();
  return app;
}
