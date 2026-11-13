import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { promises as fsp } from 'node:fs';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

/**
 * 异步导出中心 e2e：创建任务 → 后台生成 → 通知 → 下载 → 删除。
 * 真 MySQL + Redis，与其它 e2e 同一装配（createTestApp）。
 */
describe('异步导出中心 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token: string;
  const createdIds: number[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    token = await login();
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await prisma.exportTask.deleteMany({ where: { id: BigInt(id) } }).catch(() => undefined);
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

  /** 轮询任务直到终态（done/failed），超时 30s。 */
  async function waitForTask(id: number): Promise<{ status: number; message: string | null; total: number }> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/export-tasks`)
        .query({ page: 1, pageSize: 50 })
        .set('authorization', `Bearer ${token}`);
      const row = (
        res.body.data.list as Array<{ id: number; status: number; message: string | null; total: number }>
      ).find((item) => item.id === id);
      if (row && (row.status === 2 || row.status === 3)) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`任务 #${id} 30s 内未到终态`);
  }

  it('创建登录日志导出任务 → 后台生成完成 → 文件可下载且为正文字 CSV', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/export-tasks')
      .set('authorization', `Bearer ${token}`)
      .send({ module: 'login-log', query: {} })
      .expect(200);
    const id = created.body.data.id as number;
    createdIds.push(id);

    const done = await waitForTask(id);
    expect(done.status).toBe(2);
    expect(done.message).toBeNull();

    // 下载：200 + CSV 内容 sniffing（BOM + 表头关键词）
    // 自定义 parser：supertest 对 text/csv 会尝试 JSON 解析，这里要原始文本
    const download = await request(app.getHttpServer())
      .get(`/api/export-tasks/${id}/download`)
      .set('authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        let text = '';
        res.on('data', (chunk: Buffer) => {
          text += chunk.toString('utf-8');
        });
        res.on('end', () => callback(null, text));
      })
      .expect(200);
    expect(String(download.headers['content-type'])).toContain('text/csv');
    const text = download.body as unknown as string;
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text).toContain('账号');
    expect(text).toContain('登录时间');
  });

  it('创建 HTTP 日志导出任务（带筛选条件快照）也能完成', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/export-tasks')
      .set('authorization', `Bearer ${token}`)
      .send({ module: 'http-log', query: { method: 'GET', username: 'admin' } })
      .expect(200);
    const id = created.body.data.id as number;
    createdIds.push(id);

    const done = await waitForTask(id);
    expect(done.status).toBe(2);
  });

  it('不存在的导出模块被拒（400，模块白名单先于权限判定）', async () => {
    // 用 admin 登录后临时摘除权限不可行（鉴权缓存），改为直接构造无权限用户成本过高；
    // 这里以「模块白名单」为断言点：不存在的模块在创建阶段即 400（服务层口径一致）
    const res = await request(app.getHttpServer())
      .post('/api/export-tasks')
      .set('authorization', `Bearer ${token}`)
      .send({ module: 'not-a-real-log', query: {} });
    expect(res.status).toBe(400);
  });

  it('删除任务后文件与记录一并消失', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/export-tasks')
      .set('authorization', `Bearer ${token}`)
      .send({ module: 'login-log', query: {} })
      .expect(200);
    const id = created.body.data.id as number;
    await waitForTask(id);

    const row = await prisma.exportTask.findUnique({ where: { id: BigInt(id) } });
    expect(row?.filePath).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/api/export-tasks/${id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(await prisma.exportTask.findUnique({ where: { id: BigInt(id) } })).toBeNull();
    if (row?.filePath) {
      await expect(fsp.access(row.filePath)).rejects.toThrow();
    }
  });

  it('下载前校验归属：任务不存在 → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/export-tasks/999999999/download')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('未登录不可见任务列表（401）', async () => {
    await request(app.getHttpServer()).get('/api/export-tasks').expect(401);
  });
});
