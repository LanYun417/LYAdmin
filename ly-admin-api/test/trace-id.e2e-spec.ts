import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

/**
 * traceId 贯穿 e2e：响应头回带 + HTTP 访问日志按同一串 id 落库。
 * 覆盖：入站沿用 / 缺失生成 / 非法重生成。
 */
describe('traceId 全链路 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    token = await login();
  });

  afterAll(async () => {
    await app?.close();
  });

  /** 登录拿令牌（验证码答案从 Redis 取回填，与 contract e2e 同构）。 */
  async function login(): Promise<string> {
    const captcha = await request(app.getHttpServer()).get('/api/auth/captcha');
    const answer = await redis.get(`auth:captcha:${captcha.body.data.captchaId}`);
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({
      username: 'admin',
      // 口令与种子共用同一取值：CI 用 SEED_ADMIN_PASSWORD 注入，本地回退默认值
      password: resolveSeedAdminPassword(),
      captchaId: captcha.body.data.captchaId,
      captchaCode: answer,
    });
    return response.body.data.accessToken as string;
  }

  /** 轮询等待 HTTP 日志队列落库（最多约 3s）。 */
  async function waitForHttpLog(traceId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const count = await prisma.httpLog.count({ where: { traceId } });
      if (count > 0) {
        return true;
      }
    }
    return false;
  }

  it('响应头回带生成的 traceId，HTTP 访问日志按同值落库', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .query({ page: 1, pageSize: 10 })
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const responseTraceId = response.headers['x-request-id'] as string;
    expect(responseTraceId).toMatch(/^[0-9a-f]{16}$/);
    expect(await waitForHttpLog(responseTraceId)).toBe(true);
  });

  it('沿用客户端带的合规 X-Request-Id', async () => {
    const inbound = 'e2e-inbound-trace-001';
    const response = await request(app.getHttpServer())
      .get('/api/depts')
      .set('authorization', `Bearer ${token}`)
      .set('x-request-id', inbound)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(inbound);
    expect(await waitForHttpLog(inbound)).toBe(true);
  });

  it('非法入站头被丢弃并重生成（响应头与日志列都是新 id）', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menus')
      .set('authorization', `Bearer ${token}`)
      .set('x-request-id', 'x'.repeat(200))
      .expect(200);

    const regenerated = response.headers['x-request-id'] as string;
    expect(regenerated).toMatch(/^[0-9a-f]{16}$/);
    expect(await waitForHttpLog(regenerated)).toBe(true);
  });
});
