/**
 * 在线会话服务单测（假 Redis，按真实用法实现最小子集）。
 *
 * 为什么用假 Redis 而不是连真实实例：
 * 1. 需要覆盖「Redis 不可用」这条分支（create 返回 null、list 返回空），真实例上不好复现；
 * 2. 需要构造「索引里残留了已过期 sid」的脏数据，真实例上要等 TTL 到期。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionService, type SessionRecord } from '../src/common/auth/session.service.js';
import type { RedisService } from '../src/common/redis/redis.service.js';

/** 内存版 Redis（覆盖 SessionService 用到的全部方法）。 */
function createFakeRedis(options: { ready?: boolean } = {}) {
  const ready = options.ready ?? true;
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  const redis = {
    isReady: () => ready,
    set: async (key: string, value: string) => {
      if (!ready) {
        return false;
      }
      strings.set(key, value);
      return true;
    },
    get: async (key: string) => (ready ? (strings.get(key) ?? null) : null),
    del: async (key: string) => {
      strings.delete(key);
      return ready;
    },
    sAdd: async (key: string, member: string) => {
      if (!ready) {
        return false;
      }
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return true;
    },
    sRem: async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return ready;
    },
    sMembers: async (key: string) => (ready ? Array.from(sets.get(key) ?? []) : []),
    expire: async () => ready,
    delMany: async (keys: string[]) => {
      keys.forEach((key) => strings.delete(key));
      return ready;
    },
    /** 测试辅助：直接塞一条裸字符串键（模拟脏索引 / 已过期会话） */
    __raw: strings,
    __sets: sets,
  };
  return redis as unknown as RedisService & {
    __raw: Map<string, string>;
    __sets: Map<string, Set<string>>;
  };
}

/** 造一条会话入参。 */
function sessionInput(overrides: Partial<Parameters<SessionService['create']>[0]> = {}) {
  return {
    userId: 1,
    username: 'admin',
    nickname: '超级管理员',
    ip: '127.0.0.1',
    location: '本机',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    ...overrides,
  };
}

describe('SessionService', () => {
  let redis: ReturnType<typeof createFakeRedis>;
  let service: SessionService;

  beforeEach(() => {
    redis = createFakeRedis();
    service = new SessionService(redis);
  });

  it('create 生成 sid 并登记会话，isAlive 为真', async () => {
    const sid = await service.create(sessionInput());
    expect(typeof sid).toBe('string');
    expect(await service.isAlive(String(sid))).toBe(true);

    const record = await service.read(String(sid));
    expect(record).toMatchObject({ username: 'admin', ip: '127.0.0.1', location: '本机' });
    expect(record?.loginAt).toBeGreaterThan(0);
  });

  it('Redis 不可用时 create 返回 null（调用方据此签发不带 sid 的令牌）', async () => {
    const degraded = new SessionService(createFakeRedis({ ready: false }));
    expect(await degraded.create(sessionInput())).toBeNull();
    expect(await degraded.isAlive('whatever')).toBe(false);
    expect(await degraded.list()).toEqual([]);
  });

  it('touch 刷新最后活跃时间', async () => {
    const sid = String(await service.create(sessionInput()));
    const before = (await service.read(sid))?.lastSeenAt ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.touch(sid);
    expect((await service.read(sid))?.lastSeenAt ?? 0).toBeGreaterThan(before);
  });

  it('remove 后会话立即失效（这是强制下线的底层语义）', async () => {
    const sid = String(await service.create(sessionInput()));
    await service.remove(sid, 1);
    expect(await service.isAlive(sid)).toBe(false);
    // 索引里也不该再残留
    expect(await service.listAllSids()).not.toContain(sid);
    expect(await service.listSidsOfUser(1)).not.toContain(sid);
  });

  it('removeAllOfUser 清掉某用户的全部会话并返回条数', async () => {
    const other = String(await service.create(sessionInput({ username: 'tom', userId: 2 })));
    const first = String(await service.create(sessionInput()));
    const second = String(await service.create(sessionInput({ ip: '10.0.0.9' })));

    const removed = await service.removeAllOfUser(1);

    expect(removed).toBe(2);
    expect(await service.isAlive(first)).toBe(false);
    expect(await service.isAlive(second)).toBe(false);
    // 别人的会话不受影响
    expect(await service.isAlive(other)).toBe(true);
  });

  it('list 支持按账号/IP 过滤，并按最后活跃时间倒序', async () => {
    const oldSid = String(await service.create(sessionInput({ ip: '10.0.0.1' })));
    const newSid = String(await service.create(sessionInput({ ip: '10.0.0.2' })));
    await service.create(sessionInput({ userId: 2, username: 'tom' }));
    // touch 必须放在**最后**：它把 newSid 的活跃时间顶到最新。
    // 若在创建 tom 之前 touch，二者谁更新取决于毫秒级时序（慢机器上 tom 更晚），
    // 这条断言就会变成 flaky——真实 CI 上就是这么挂的。
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.touch(newSid);

    const all = await service.list();
    expect(all[0]?.sid).toBe(newSid); // 最近活跃在最前
    expect(all.map((item) => item.sid)).toContain(oldSid);

    expect((await service.list({ username: 'tom' })).every((item) => item.username === 'tom')).toBe(true);
    expect((await service.list({ ip: '10.0.0.2' })).map((item) => item.sid)).toEqual([newSid]);
    expect(await service.list({ ip: '192.168.1.1' })).toEqual([]);
  });

  it('list 顺带清理索引里残留的失效 sid', async () => {
    const alive = String(await service.create(sessionInput()));
    // 模拟"会话已过期但索引还在"：只往索引里加一个不存在的 sid
    await redis.sAdd('auth:session:index', '00000000-0000-4000-8000-000000000000');

    const records = await service.list();

    expect(records.map((item) => item.sid)).toEqual([alive]);
    expect(await service.listAllSids()).not.toContain('00000000-0000-4000-8000-000000000000');
  });

  describe('enforceDeviceLimit（登录设备并发控制）', () => {
    /**
     * 按「从旧到新」造 n 个会话：create 的 lastSeenAt 都是 now，无法区分先后，
     * 借 __raw 改写 lastSeenAt 为确定的时间戳（index 越小越旧），让回收顺序可预期。
     */
    async function seedSessions(count: number): Promise<string[]> {
      const sids: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const sid = String(await service.create(sessionInput({ ip: `10.0.0.${index + 1}` })));
        const raw = redis.__raw.get(`auth:session:${sid}`);
        if (raw) {
          const record = JSON.parse(raw) as SessionRecord;
          record.lastSeenAt = 1000 + index;
          redis.__raw.set(`auth:session:${sid}`, JSON.stringify(record));
        }
        sids.push(sid);
      }
      return sids;
    }

    it('未达上限不回收任何会话', async () => {
      const sids = await seedSessions(2);

      expect(await service.enforceDeviceLimit(1, 3)).toEqual([]);
      for (const sid of sids) {
        expect(await service.isAlive(sid)).toBe(true);
      }
    });

    it('达到上限只回收最旧的一台，为即将登记的新会话保留名额', async () => {
      const sids = await seedSessions(3); // lastSeenAt 1000 / 1001 / 1002

      const evicted = await service.enforceDeviceLimit(1, 3);

      expect(evicted.map((item) => item.sid)).toEqual([sids[0]]);
      expect(evicted[0]?.ip).toBe('10.0.0.1');
      expect(await service.isAlive(sids[0])).toBe(false);
      expect(await service.isAlive(sids[1])).toBe(true);
      expect(await service.isAlive(sids[2])).toBe(true);
      // 索引也要同步清理
      expect(await service.listSidsOfUser(1)).not.toContain(sids[0]);
      // 回收后剩 2 台 + 新会话 = 3 台，正好到上限
      expect(await service.listSidsOfUser(1)).toHaveLength(2);
    });

    it('超出多台时按从旧到新依次回收', async () => {
      const sids = await seedSessions(5);

      const evicted = await service.enforceDeviceLimit(1, 3);

      expect(evicted.map((item) => item.sid)).toEqual(sids.slice(0, 3));
      expect(await service.listSidsOfUser(1)).toEqual(expect.arrayContaining([sids[3], sids[4]]));
    });

    it('maxDevices 为 1 时全部回收（新会话独占）', async () => {
      const sids = await seedSessions(3);

      const evicted = await service.enforceDeviceLimit(1, 1);

      expect(evicted).toHaveLength(3);
      for (const sid of sids) {
        expect(await service.isAlive(sid)).toBe(false);
      }
    });

    it('maxDevices ≤ 0 视为不限制，一台都不回收', async () => {
      const sids = await seedSessions(5);

      expect(await service.enforceDeviceLimit(1, 0)).toEqual([]);
      for (const sid of sids) {
        expect(await service.isAlive(sid)).toBe(true);
      }
    });

    it('只回收目标用户的会话，其他人的在线状态不受影响', async () => {
      const mine = await seedSessions(3);
      const others = String(await service.create(sessionInput({ userId: 2, username: 'tom' })));

      const evicted = await service.enforceDeviceLimit(1, 2);

      expect(evicted).toHaveLength(2);
      expect(await service.isAlive(mine[2])).toBe(true);
      expect(await service.isAlive(others)).toBe(true);
      expect(await service.listSidsOfUser(2)).toEqual([others]);
    });
  });
});
