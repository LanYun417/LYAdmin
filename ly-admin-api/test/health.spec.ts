/**
 * 健康检查探针语义单测。
 * 覆盖无法靠 e2e 稳定复现的分支：MySQL 不可用必须 503；Redis 不可用只降级不 503
 * （若也 503，Redis 抖动会导致编排系统把全部实例摘除，属故障放大）；Redis 未配置算 disabled。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/common/config/config.js';
import type { RedisService } from '../src/common/redis/redis.service.js';
import { HealthController } from '../src/modules/health/health.controller.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/** 造一个只暴露被测方法的假 Prisma。 */
function fakePrisma(options: { dbUp: boolean }): PrismaService {
  return {
    $queryRaw: options.dbUp ? vi.fn().mockResolvedValue([{ '1': 1 }]) : vi.fn().mockRejectedValue(new Error('down')),
  } as unknown as PrismaService;
}

/** 造一个只暴露 ping 的假 Redis。 */
function fakeRedis(pingResult: boolean): RedisService {
  return { ping: vi.fn().mockResolvedValue(pingResult) } as unknown as RedisService;
}

/** 直接改 REDIS_HOST 的取值：`config` 是 `as const`（仅类型只读，运行期可改）。 */
function setRedisHost(host: string): void {
  (config.redis as { host: string }).host = host;
}

const originalRedisHost = config.redis.host;

describe('HealthController', () => {
  beforeEach(() => {
    setRedisHost('127.0.0.1');
  });

  afterEach(() => {
    setRedisHost(originalRedisHost);
  });

  it('live 不探测任何依赖，恒返回 ok', () => {
    const controller = new HealthController(fakePrisma({ dbUp: false }), fakeRedis(false));
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.name).toBe('ly-admin-api');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.version).toBe('string');
  });

  it('MySQL 不可用 → ready 抛 503（业务码与 HTTP 状态码一致）', async () => {
    const controller = new HealthController(fakePrisma({ dbUp: false }), fakeRedis(true));
    await expect(controller.ready()).rejects.toMatchObject({ code: 503 });
  });

  it('MySQL 可用但 Redis 不通 → 200 且 status=degraded', async () => {
    const controller = new HealthController(fakePrisma({ dbUp: true }), fakeRedis(false));
    const result = await controller.ready();
    expect(result.checks.db.status).toBe('up');
    expect(result.checks.redis.status).toBe('down');
    expect(result.status).toBe('degraded');
  });

  it('Redis 未配置 → disabled，且整体仍为 ready（不算故障）', async () => {
    setRedisHost('');
    const controller = new HealthController(fakePrisma({ dbUp: true }), fakeRedis(false));
    const result = await controller.ready();
    expect(result.checks.redis.status).toBe('disabled');
    expect(result.status).toBe('ready');
  });

  it('依赖全通 → status=ready，并带出探测延迟', async () => {
    const controller = new HealthController(fakePrisma({ dbUp: true }), fakeRedis(true));
    const result = await controller.ready();
    expect(result.status).toBe('ready');
    expect(result.checks.redis.status).toBe('up');
    expect(result.checks.db.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
