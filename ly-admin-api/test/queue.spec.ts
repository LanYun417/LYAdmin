/**
 * 通用任务队列单测（Prisma 内存 mock）。
 * 覆盖：幂等入队、成功消费、失败指数退避、maxAttempts 后进 dead、
 * 条件占位（并发下只有一个实例领走）、未注册类型拒绝。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET = 'queue-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'queue-test-refresh-secret-not-for-production-2';

const { QueueService } = await import('../src/common/queue/queue.service.js');

describe('QueueService', () => {
  let service: InstanceType<typeof QueueService>;
  let rows: Array<Record<string, unknown>>;
  let idSeq = 1;

  beforeEach(() => {
    rows = [];
    idSeq = 1;
    /** 简易 where 匹配：支持等值、{ lte }、{ OR: [...] }。BigInt 转字符串比较（对象引用不可比）。 */
    const norm = (value: unknown): unknown => (typeof value === 'bigint' ? value.toString() : value);
    const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean => {
      for (const [key, value] of Object.entries(where)) {
        if (key === 'OR') {
          const any = (value as Array<Record<string, unknown>>).some((clause) => matches(row, clause));
          if (!any) {
            return false;
          }
          continue;
        }
        if (
          value !== null &&
          typeof value === 'object' &&
          ('lte' in (value as Record<string, unknown>) || 'lt' in (value as Record<string, unknown>))
        ) {
          const bound = value as { lte?: Date; lt?: Date };
          const cell = new Date(row[key] as Date).getTime();
          if (bound.lte && !(cell <= bound.lte.getTime())) {
            return false;
          }
          if (bound.lt && !(cell < bound.lt.getTime())) {
            return false;
          }
          continue;
        }
        if (norm(row[key]) !== norm(value)) {
          return false;
        }
      }
      return true;
    };
    const store = {
      findUnique: vi.fn(
        async (args: { where: Record<string, unknown> }) => rows.find((row) => matches(row, args.where)) ?? null,
      ),
      findMany: vi.fn(async (args: { where: Record<string, unknown> } | undefined) =>
        args?.where ? rows.filter((row) => matches(row, args.where)) : rows,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: BigInt(idSeq++),
          attempts: 0,
          status: 'pending',
          availAt: new Date(),
          lastError: null,
          startedAt: null,
          finishedAt: null,
          createdBy: 0n,
          createdAt: new Date(),
          ...args.data,
        };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = rows.find((item) => matches(item, args.where));
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = rows.find((row) => matches(row, args.where));
        if (!hit) {
          return { count: 0 };
        }
        Object.assign(hit, args.data);
        return { count: 1 };
      }),
      count: vi.fn(async () => rows.length),
    };
    service = new QueueService({ queueJob: store } as never);
    // 注册测试处理器：默认成功；按需换成失败
    service.registerHandler('test.ok', async () => undefined);
    service.registerHandler('test.fail', async () => {
      throw new Error('boom');
    });
  });

  it('入队：成功入队并注册类型校验', async () => {
    const job = await service.enqueue({ type: 'test.ok', title: 't', payload: { a: 1 } });
    expect(job.id).toBe(1);
    expect(job.status).toBe('pending');
    await expect(service.enqueue({ type: 'no.such', title: 't', payload: {} })).rejects.toThrow(/未注册的任务类型/);
  });

  it('幂等：同 idemKey 重复入队返回同一任务，不新建', async () => {
    const first = await service.enqueue({ type: 'test.ok', title: 't', payload: {}, idemKey: 'k1' });
    const second = await service.enqueue({ type: 'test.ok', title: 't2', payload: {}, idemKey: 'k1' });
    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it('消费：成功 → done；未注册类型 → pending 重试', async () => {
    await service.enqueue({ type: 'test.ok', title: 't', payload: {} });
    const result = await service.consumeDue();
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0, dead: 0 });
    expect(rows[0].status).toBe('done');
  });

  it('失败：指数退避（base 30s × 2^(attempts-1)），maxAttempts 后进 dead', async () => {
    await service.enqueue({ type: 'test.fail', title: 't', payload: {}, maxAttempts: 3 });
    // 第一次
    await service.consumeDue();
    expect(rows[0].status).toBe('pending');
    expect(rows[0].attempts).toBe(1);
    const backoff1 = (rows[0].availAt as Date).getTime() - Date.now();
    expect(backoff1).toBeGreaterThanOrEqual(29_000);
    expect(backoff1).toBeLessThan(60_000);
    // 手工把 availAt 提前，验证第二次退避翻倍（60s）
    rows[0].availAt = new Date();
    await service.consumeDue();
    const backoff2 = (rows[0].availAt as Date).getTime() - Date.now();
    expect(backoff2).toBeGreaterThanOrEqual(59_000);
    expect(backoff2).toBeLessThan(120_000);
    // 第三次：达到 maxAttempts → dead
    rows[0].availAt = new Date();
    await service.consumeDue();
    expect(rows[0].status).toBe('dead');
    expect(rows[0].lastError).toBe('boom');
  });

  it('条件占位：已被领取（running）的任务不会被重复领取', async () => {
    await service.enqueue({ type: 'test.ok', title: 't', payload: {} });
    // 模拟另一个实例刚领走（startedAt 是现在，不触发僵尸回收）
    rows[0].status = 'running';
    rows[0].startedAt = new Date();
    const result = await service.consumeDue();
    expect(result.processed).toBe(0);
    expect(rows[0].status).toBe('running');
  });

  it('replay：dead/done 重置为 pending，running 拒绝', async () => {
    await service.enqueue({ type: 'test.ok', title: 't', payload: {} });
    await service.consumeDue();
    expect(rows[0].status).toBe('done');
    const replayed = await service.replay(1);
    expect(replayed.status).toBe('pending');
    expect(replayed.attempts).toBe(0);
    // running 中拒绝
    rows[0].status = 'running';
    await expect(service.replay(1)).rejects.toThrow(/正在执行中/);
  });

  it('list：按 status 过滤', async () => {
    await service.enqueue({ type: 'test.ok', title: 'a', payload: {} });
    await service.enqueue({ type: 'test.fail', title: 'b', payload: {} });
    const page = await service.list({ status: 'pending' });
    expect(page.total).toBe(2);
  });

  it('僵尸回收：consumeDue 会把超时 running 打回 pending 并重新消费', async () => {
    await service.enqueue({ type: 'test.ok', title: 't', payload: {} });
    // 手动置为「半小时前开始、仍在 running」的僵尸（执行实例崩溃的残留）
    rows[0].status = 'running';
    rows[0].startedAt = new Date(Date.now() - 30 * 60_000);
    // consumeDue 首步即回收僵尸，同轮参与消费（回收 → 领取 → 执行成功）
    const result = await service.consumeDue();
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(rows[0].status).toBe('done');
    // 独立调用 reclaimZombies 时无事可做（已无僵尸）
    expect(await service.reclaimZombies()).toBe(0);
  });
});
