import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './setup-app.js';

/**
 * 应用装配冒烟（e2e）。
 *
 * 覆盖全局约定：路由前缀 /api、统一响应信封、鉴权守卫与异常过滤器的状态码。
 * 装配取自 `setup-app.ts`（与 `src/main.ts` 共用 `configureApp`），故与生产实例一致 ——
 * 若此处手写 `createNestApplication()` + `setGlobalPrefix()`，会缺校验管道与自定义适配器，
 * 「测的装配」与「跑的装配」并不相同。
 *
 * 注意：AppModule 初始化时会连接 MySQL 与 Redis，因此运行本测试需要本地环境可用。
 */
describe('应用装配冒烟 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api 健康检查返回统一响应信封', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);
    expect(res.body).toMatchObject({ code: 200, message: 'success' });
    expect(res.body.data).toMatchObject({ name: 'ly-admin-api', status: 'ok' });
  });

  it('未携带令牌访问受保护接口返回 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/users').expect(401);
    expect(res.body.code).toBe(401);
  });

  it('未知路由返回 404，且同样走统一错误信封', async () => {
    const res = await request(app.getHttpServer()).get('/api/not-exist-xyz').expect(404);
    expect(res.body.code).toBe(404);
  });
});
