import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('存活探针 GET /api/health/live 公开可访问且不依赖外部组件', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/live').expect(200);
    expect(res.body).toMatchObject({ code: 200, data: { name: 'ly-admin-api', status: 'ok' } });
    // 进程元信息：版本与环境由构建注入，缺失时为 dev，故只断言存在与类型
    expect(typeof res.body.data.version).toBe('string');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('就绪探针 GET /api/health/ready 探测 MySQL 与 Redis 并回报延迟', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    const { status, checks } = res.body.data as {
      status: string;
      checks: { db: { status: string; latencyMs: number }; redis: { status: string; latencyMs: number } };
    };
    // 测试环境 MySQL 必须可用；Redis 可能没配置（disabled）或已连接（up）
    expect(checks.db.status).toBe('up');
    expect(checks.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(['up', 'down', 'disabled']).toContain(checks.redis.status);
    expect(['ready', 'degraded']).toContain(status);
    // Redis 未降级时整体必须是 ready（护栏：别把 disabled 误判成降级）
    if (checks.redis.status !== 'down') {
      expect(status).toBe('ready');
    }
  });
});

/**
 * 同源部署（后端托管前端产物）的回归护栏。
 *
 * history 回退注册在 Nest 控制器路由之前，必须对 /api 调用 next()；否则静态模式下所有接口
 * 都会被回退处理器吞掉（返回 404）。此用例之前只靠手工 curl 才发现，必须由测试锁住。
 */
describe('同源部署静态托管 (e2e)', () => {
  let app: NestExpressApplication;
  let webDistDir: string;

  beforeAll(async () => {
    webDistDir = mkdtempSync(join(tmpdir(), 'ly-admin-web-'));
    writeFileSync(join(webDistDir, 'index.html'), '<!doctype html><title>static-fallback</title>');
    app = await createTestApp({ serveStatic: true, webDistDir });
  });

  afterAll(async () => {
    await app.close();
    rmSync(webDistDir, { recursive: true, force: true });
  });

  it('history 回退不吞掉 /api 路由', async () => {
    const health = await request(app.getHttpServer()).get('/api').expect(200);
    expect(health.body).toMatchObject({ code: 200 });

    const protectedRes = await request(app.getHttpServer()).get('/api/users').expect(401);
    expect(protectedRes.body.code).toBe(401);
  });

  it('非 API 的页面导航回退 index.html', async () => {
    const res = await request(app.getHttpServer())
      .get('/system/user')
      .set('Accept', 'text/html,application/xhtml+xml')
      .expect(200);
    expect(res.text).toContain('static-fallback');
  });

  it('构建产物下发长期缓存头，index.html 保持不缓存', async () => {
    mkdirSync(join(webDistDir, 'assets'), { recursive: true });
    writeFileSync(join(webDistDir, 'assets', 'app.js'), 'console.log(1);');

    const asset = await request(app.getHttpServer()).get('/assets/app.js').expect(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    const index = await request(app.getHttpServer()).get('/').expect(200);
    expect(index.headers['cache-control']).toContain('no-cache');
  });
});
