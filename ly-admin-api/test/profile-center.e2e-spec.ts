import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

/**
 * 用户中心 Sprint 5 e2e：个人中心详情（账户 + 扩展资料 + 会话画像）、
 * 扩展资料更新、会话归属校验。
 */
describe('用户中心 Sprint 5 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    token = await login();
  });

  afterAll(async () => {
    // 清掉测试写入的扩展资料（种子账号恢复干净）
    const admin = await prisma.user.findUnique({ where: { username: 'admin' }, select: { id: true } });
    if (admin) {
      await prisma.userProfile.deleteMany({ where: { userId: admin.id } }).catch(() => undefined);
    }
    await app?.close();
  });

  async function login(): Promise<string> {
    const captcha = await request(app.getHttpServer()).get('/api/auth/captcha');
    const answer = await redis.get(`auth:captcha:${captcha.body.data.captchaId}`);
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({
      username: 'admin',
      password: resolveSeedAdminPassword(),
      captchaId: captcha.body.data.captchaId,
      captchaCode: answer,
    });
    return response.body.data.accessToken as string;
  }

  it('详情返回账户 + 空扩展资料 + 会话画像（当前会话标记为 current）', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/profile')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const detail = response.body.data;
    expect(detail.username).toBe('admin');
    expect(detail).toHaveProperty('signature');
    expect(Array.isArray(detail.sessions)).toBe(true);
    expect(detail.sessions.length).toBeGreaterThanOrEqual(1);
    // 当前请求的会话必须被标出来（前端「本机」标签的依据）
    expect(detail.sessions.some((session: { current: boolean }) => session.current)).toBe(true);
    // 画像项字段齐备（前端渲染浏览器/系统/在线时长）
    const first = detail.sessions[0];
    expect(first).toHaveProperty('browser');
    expect(first).toHaveProperty('loginAt');
    expect(first).toHaveProperty('lastSeenAt');
  });

  it('更新扩展资料 → 读回一致（懒创建 upsert）', async () => {
    await request(app.getHttpServer())
      .put('/api/profile/extra')
      .set('authorization', `Bearer ${token}`)
      .send({
        signature: 'Sprint 5 测试签名',
        birthday: '1990-01-02',
        company: 'LY',
        position: '工程师',
        address: '浙江 杭州',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/profile')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const detail = response.body.data;
    expect(detail.signature).toBe('Sprint 5 测试签名');
    expect(String(detail.birthday).slice(0, 10)).toBe('1990-01-02');
    expect(detail.company).toBe('LY');
    expect(detail.position).toBe('工程师');
    expect(detail.address).toBe('浙江 杭州');

    // 再提交一次：走 update 分支（upsert 幂等）
    await request(app.getHttpServer())
      .put('/api/profile/extra')
      .set('authorization', `Bearer ${token}`)
      .send({ signature: '改了' })
      .expect(200);
    const again = await request(app.getHttpServer()).get('/api/profile').set('authorization', `Bearer ${token}`);
    expect(again.body.data.signature).toBe('改了');
    expect(again.body.data.company).toBeNull();
  });

  it('非法生日格式 → 400（DTO 校验）', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/profile/extra')
      .set('authorization', `Bearer ${token}`)
      .send({ birthday: '1990/01/02' });
    expect(response.status).toBe(400);
  });

  it('下线不存在的会话 → 403（归属校验，防踢别人）', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/profile/sessions/00000000-0000-4000-8000-000000000000')
      .set('authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('未登录不可访问详情（401）', async () => {
    await request(app.getHttpServer()).get('/api/profile').expect(401);
  });
});
