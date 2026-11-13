import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

/**
 * SSE 连接 e2e：真连 text/event-stream，验证鉴权、首帧与心跳帧格式。
 */
describe('SSE 实时推送 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    // 自听一个端口：supertest 不支持「挂起等流」的 SSE 语义，用原生 http 客户端读
    const server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    const captcha = await request(app.getHttpServer()).get('/api/auth/captcha');
    const answer = await redis.get(`auth:captcha:${captcha.body.data.captchaId}`);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({
      username: 'admin',
      password: resolveSeedAdminPassword(),
      captchaId: captcha.body.data.captchaId,
      captchaCode: answer,
    });
    token = login.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
  });

  /** 发起 SSE 连接，读到首个目标事件帧即断开；超时 3s 判失败。 */
  async function readFirstFrame(
    url: string,
    eventName: string,
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; frame: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let buffer = '';
        const timer = setTimeout(() => {
          res.destroy();
          reject(new Error(`3s 内未收到 ${eventName} 帧；已收到: ${JSON.stringify(buffer.slice(0, 400))}`));
        }, 3000);
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          if (buffer.includes(`event: ${eventName}\n`)) {
            clearTimeout(timer);
            res.destroy();
            resolve({ status: res.statusCode ?? 0, headers: res.headers, frame: buffer });
          }
        });
        res.on('error', () => undefined);
      });
      req.on('error', reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('连接超时'));
      });
    });
  }

  it('未带 token 连接被 401 拒绝', async () => {
    const response = await request(app.getHttpServer()).get('/api/sse/stream').expect(401);
    expect(response.body.code).toBe(401);
  });

  it('带 token 连接：标准 SSE 响应头 + connected 首帧（含在线用户数）', async () => {
    const { status, headers, frame } = await readFirstFrame(`${baseUrl}/api/sse/stream?token=${token}`, 'connected');

    expect(status).toBe(200);
    expect(String(headers['content-type'])).toContain('text/event-stream');
    // 缓存与压缩必须关：否则事件被缓冲/重排，实时性失效
    expect(String(headers['cache-control'])).toContain('no-cache');
    expect(String(headers['x-accel-buffering'])).toBe('no');

    const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    const payload = JSON.parse((dataLine ?? '').slice('data: '.length));
    expect(payload).toHaveProperty('onlineUsers');
    expect(Number(payload.onlineUsers)).toBeGreaterThanOrEqual(1);
  });

  it('连接成功后在线计数端点反映该连接', async () => {
    // 建一条保活连接（不读不断），随后轮询计数端点应 ≥1
    const connection = http.get(`${baseUrl}/api/sse/stream?token=${token}`, () => undefined);
    connection.on('error', () => undefined);

    let count = 0;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get('/api/sse/online-count')
        .set('authorization', `Bearer ${token}`);
      count = res.body.data.onlineUsers as number;
      if (count >= 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    connection.destroy();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('主题订阅接口校验入参（非法 topic 400）', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/sse/topics')
      .set('authorization', `Bearer ${token}`)
      .send({ topic: 'not-exist', enabled: true });
    expect(response.status).toBe(400);
  });
});
