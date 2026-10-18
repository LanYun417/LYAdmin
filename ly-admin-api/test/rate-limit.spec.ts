/**
 * 接口限流中间件单测。
 *
 * 为什么用假 Redis 而不是打真接口：验证 429 需要把计数打过阈值（默认 300 次/分钟），
 * 用 fake 直接给计数既快又覆盖得到分支；同时能覆盖「Redis 降级放行」这条真环境难以复现的分支。
 */
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/common/config/config.js';
import { RateLimitMiddleware } from '../src/common/http/rate-limit.middleware.js';
import type { RedisService } from '../src/common/redis/redis.service.js';

/** 造一个只暴露限流用到的两个方法的假 Redis。 */
function fakeRedis(options: { count: number; ttlMs?: number }): RedisService {
  return {
    incrWithTtl: vi.fn().mockResolvedValue(options.count),
    pttl: vi.fn().mockResolvedValue(options.ttlMs ?? 30_000),
  } as unknown as RedisService;
}

/** 可断言的假响应（记录 header / 状态码 / 响应体）。 */
interface FakeResponse extends Response {
  __headers: Record<string, string>;
  __status?: number;
  __body?: unknown;
}

/** 造一个记录 header / 状态的假响应。 */
function fakeResponse(): FakeResponse {
  const res = {
    __headers: {} as Record<string, string>,
    __status: undefined as number | undefined,
    __body: undefined as unknown,
  } as unknown as FakeResponse;
  res.setHeader = (name: string, value: string): FakeResponse => {
    res.__headers[name] = value;
    return res;
  };
  res.status = (code: number): FakeResponse => {
    res.__status = code;
    return res;
  };
  res.json = (body?: unknown): FakeResponse => {
    res.__body = body;
    return res;
  };
  return res;
}

/** 造一个最小请求对象。 */
function fakeRequest(path: string, ip = '10.0.0.1'): Request {
  return { originalUrl: path, url: path, ip } as unknown as Request;
}

const originalEnabled = config.rateLimit.enabled;

describe('RateLimitMiddleware', () => {
  beforeEach(() => {
    (config.rateLimit as { enabled: boolean }).enabled = true;
  });

  afterEach(() => {
    (config.rateLimit as { enabled: boolean }).enabled = originalEnabled;
  });

  it('未超限时放行，并带出限额与余量响应头', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 5 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.__headers['X-RateLimit-Limit']).toBe(String(config.rateLimit.max));
    expect(res.__headers['X-RateLimit-Remaining']).toBe(String(config.rateLimit.max - 5));
    expect(res.__status).toBeUndefined();
  });

  it('超过全局阈值返回 429 信封与 Retry-After（不抛异常、不依赖异常过滤器）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: config.rateLimit.max + 1, ttlMs: 42_000 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.__status).toBe(429);
    expect(res.__body).toMatchObject({ code: 429, data: null });
    expect(res.__headers['Retry-After']).toBe('42');
  });

  it('登录接口用更严的阈值（20 次/窗口，防换账号爆破）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 21 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/auth/login'), res, next);

    expect(res.__status).toBe(429);
    expect(res.__headers['X-RateLimit-Limit']).toBe('20');
  });

  it('健康检查与根探活不计入限流（探针是高频请求，否则会自己打成 429）', async () => {
    const redis = fakeRedis({ count: 1 });
    const middleware = new RateLimitMiddleware(redis);
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/health/live'), fakeResponse(), next);
    await middleware.use(fakeRequest('/api/health/ready'), fakeResponse(), next);
    await middleware.use(fakeRequest('/api'), fakeResponse(), next);

    expect(next).toHaveBeenCalledTimes(3);
    expect((redis.incrWithTtl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it('Redis 不可用时降级放行（计数 0 表示未启用/异常，不得因此全站 429）', async () => {
    const middleware = new RateLimitMiddleware(fakeRedis({ count: 0 }));
    const res = fakeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await middleware.use(fakeRequest('/api/users'), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.__status).toBeUndefined();
    expect(res.__headers['X-RateLimit-Limit']).toBeUndefined();
  });
});
