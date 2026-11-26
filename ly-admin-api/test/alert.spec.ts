/**
 * 告警中心服务单测（Prisma / Redis 全部 mock，渠道分发以 email/wecom 为例验证状态落库）。
 * 覆盖：渠道加密入库与脱敏输出、级别匹配、冷却去重、投递状态判定、未知渠道兜底。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SECRETS_ENCRYPTION_KEY = 'd'.repeat(64);
process.env.JWT_ACCESS_SECRET = 'alert-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'alert-test-refresh-secret-not-for-production-2';

const { AlertService } = await import('../src/modules/alert/alert.service.js');
const { decryptSecret } = await import('../src/common/crypto/secret-box.js');

/** 邮件渠道配置（pass 为明文，落库时应变为 v1: 信封）。 */
const EMAIL_INPUT = {
  type: 'email',
  name: '运维邮件',
  config: { host: 'smtp.example.com', port: '465', user: 'bot', pass: 'smtp-password', to: 'ops@example.com' },
};

/** 内存 Redis mock（含 NX 语义）。 */
const redisStore = new Map<string, string>();
const redis = {
  set: vi.fn(async (key: string, value: string) => {
    redisStore.set(key, value);
    return true;
  }),
  setNx: vi.fn(async (key: string, value: string) => {
    if (redisStore.has(key)) {
      return false;
    }
    redisStore.set(key, value);
    return true;
  }),
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  del: vi.fn(async (key: string) => redisStore.delete(key)),
  isReady: vi.fn(() => true),
};

function makePrisma() {
  const channels: Array<Record<string, unknown>> = [];
  const rules: Array<Record<string, unknown>> = [];
  const records: Array<Record<string, unknown>> = [];
  let idSeq = 1;
  /** 计数辅助：按传入 id 集合统计（对齐 Prisma count({ where: { id: { in } } }) 语义）。 */
  const countByIds = (ids: bigint[]): number => channels.filter((row) => ids.some((id) => row.id === id)).length;
  return {
    __data: { channels, rules, records },
    alertChannel: {
      findMany: vi.fn(async (args: { where?: { status: number } } | undefined) =>
        channels.filter((row) => !args?.where || Number(row.status) === args.where.status),
      ),
      findUnique: vi.fn(
        async (args: { where: { id: bigint } }) => channels.find((row) => row.id === args.where.id) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async (args: { where: { id: bigint } }) => {
        const found = channels.find((row) => row.id === args.where.id);
        if (!found) throw new Error('not found');
        return found;
      }),
      count: vi.fn(async (args?: { where?: { id?: { in: bigint[] } } }) =>
        args?.where?.id?.in ? countByIds(args.where.id.in) : channels.length,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(idSeq++), createdAt: new Date(), updatedAt: new Date(), ...args.data };
        channels.push(row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = channels.find((item) => item.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      delete: vi.fn(async (args: { where: { id: bigint } }) => {
        const index = channels.findIndex((row) => row.id === args.where.id);
        if (index < 0) throw new Error('not found');
        return channels.splice(index, 1)[0];
      }),
    },
    alertRule: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> } | undefined) =>
        rules.filter((row) => {
          if (!args?.where) return true;
          if (args.where.status !== undefined && Number(row.status) !== args.where.status) return false;
          if (args.where.eventType !== undefined && row.eventType !== args.where.eventType) return false;
          return true;
        }),
      ),
      findUnique: vi.fn(
        async (args: { where: { id: bigint } }) => rules.find((row) => row.id === args.where.id) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async (args: { where: { id: bigint } }) => {
        const found = rules.find((row) => row.id === args.where.id);
        if (!found) throw new Error('not found');
        return found;
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(idSeq++), createdAt: new Date(), updatedAt: new Date(), ...args.data };
        rules.push(row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = rules.find((item) => item.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      delete: vi.fn(async (args: { where: { id: bigint } }) => {
        const index = rules.findIndex((row) => row.id === args.where.id);
        if (index < 0) throw new Error('not found');
        return rules.splice(index, 1)[0];
      }),
    },
    alertRecord: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(idSeq++), createdAt: new Date(), sentAt: null, ...args.data };
        records.push(row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = records.find((item) => item.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      findUnique: vi.fn(
        async (args: { where: { id: bigint } }) => records.find((row) => row.id === args.where.id) ?? null,
      ),
      findMany: vi.fn(async () => records),
      count: vi.fn(async () => records.length),
    },
  };
}

describe('AlertService', () => {
  let service: InstanceType<typeof AlertService>;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    redisStore.clear();
    prisma = makePrisma();
    service = new AlertService(prisma as never, redis as never);
  });

  it('新增邮件渠道：pass 信封加密入库，列表输出脱敏', async () => {
    const created = await service.createChannel(EMAIL_INPUT as unknown as Record<string, unknown>, 1);
    const stored = prisma.__data.channels[0].config as string;
    const storedConfig = JSON.parse(stored) as Record<string, string>;
    expect(storedConfig.pass.startsWith('v1:')).toBe(true);
    expect(decryptSecret(storedConfig.pass)).toBe('smtp-password');
    // 对外不含明文密钥
    const item = created as unknown as { config: Record<string, unknown> };
    expect(item.config.pass).toBe('***');
  });

  it('更新渠道时未提供的密钥保留原密文', async () => {
    await service.createChannel(EMAIL_INPUT as unknown as Record<string, unknown>, 1);
    await service.updateChannel(
      1,
      {
        type: 'email',
        name: '运维邮件',
        config: { host: 'smtp.example.com', to: 'ops@example.com' },
      } as unknown as Record<string, unknown>,
      1,
    );
    const stored = JSON.parse(prisma.__data.channels[0].config as string) as Record<string, string>;
    expect(stored.pass.startsWith('v1:')).toBe(true);
    expect(decryptSecret(stored.pass)).toBe('smtp-password');
  });

  it('未知渠道类型 / 缺少必填配置被拒绝', async () => {
    await expect(
      service.createChannel({ type: 'sms', name: 'x', config: {} } as unknown as Record<string, unknown>, 1),
    ).rejects.toThrow(/不支持的渠道类型/);
    await expect(
      service.createChannel(
        { type: 'email', name: 'x', config: { host: 'a' } } as unknown as Record<string, unknown>,
        1,
      ),
    ).rejects.toThrow(/host 与收件人/);
  });

  it('规则校验：级别非法 / 渠道不存在 / 渠道为空均拒绝', async () => {
    await expect(
      service.createRule(
        { name: 'r', eventType: 'e', level: 'fatal', channelIds: [1] } as unknown as Record<string, unknown>,
        1,
      ),
    ).rejects.toThrow(/不支持的告警级别/);
    await expect(
      service.createRule(
        { name: 'r', eventType: 'e', level: 'info', channelIds: [] } as unknown as Record<string, unknown>,
        1,
      ),
    ).rejects.toThrow(/至少选择一个通知渠道/);
    await expect(
      service.createRule(
        { name: 'r', eventType: 'e', level: 'info', channelIds: [999] } as unknown as Record<string, unknown>,
        1,
      ),
    ).rejects.toThrow(/引用的通知渠道不存在/);
  });

  it('publish：级别匹配 + 冷却去重 + 停用渠道被过滤', async () => {
    // 启用渠道 1（邮件）、停用渠道 2（wecom）
    await service.createChannel(EMAIL_INPUT as unknown as Record<string, unknown>, 1);
    await service.createChannel(
      {
        type: 'wecom',
        name: '停用群',
        config: { webhook: 'https://qyapi.weixin.qq.com/x' },
        status: 0,
      } as unknown as Record<string, unknown>,
      1,
    );
    // 两条规则：warning 规则（订阅 warning）+ info 规则（订阅 info）
    await service.createRule(
      {
        name: '导出失败提醒',
        eventType: 'export.failed',
        level: 'warning',
        channelIds: [1, 2],
        cooldownSeconds: 600,
      } as unknown as Record<string, unknown>,
      1,
    );
    await service.createRule(
      {
        name: '全部事件',
        eventType: 'export.failed',
        level: 'info',
        channelIds: [1],
        cooldownSeconds: 600,
      } as unknown as Record<string, unknown>,
      1,
    );

    // info 事件：不触发 warning 规则，只触发 info 规则
    await service.publish({ eventType: 'export.failed', level: 'info', title: 't', message: 'm', dedupKey: 'info-1' });
    expect(prisma.__data.records).toHaveLength(1);
    expect(prisma.__data.records[0].ruleName).toBe('全部事件');

    // critical 事件：同时命中两条规则（两个规则各自的冷却键都未命中）
    await service.publish({
      eventType: 'export.failed',
      level: 'critical',
      title: 't2',
      message: 'm2',
      dedupKey: 'critical-1',
    });
    expect(prisma.__data.records).toHaveLength(3);

    // 冷却：同一规则 + 同一 dedupKey 在窗口内不再投递（两条规则都已有该 dedupKey 的记录）
    await service.publish({
      eventType: 'export.failed',
      level: 'critical',
      title: 't3',
      message: 'm3',
      dedupKey: 'critical-1',
    });
    expect(prisma.__data.records).toHaveLength(3);
  });

  it('publish：渠道全部停用 → 记录落库为 failed', async () => {
    await service.createChannel(
      {
        type: 'wecom',
        name: '已停用',
        config: { webhook: 'https://qyapi.weixin.qq.com/x' },
        status: 0,
      } as unknown as Record<string, unknown>,
      1,
    );
    await service.createRule(
      {
        name: 'r',
        eventType: 'export.failed',
        level: 'info',
        channelIds: [1],
        cooldownSeconds: 0,
      } as unknown as Record<string, unknown>,
      1,
    );
    await service.publish({ eventType: 'export.failed', level: 'info', title: 't', message: 'm' });
    expect(prisma.__data.records[0].status).toBe('failed');
  });

  it('publish：Redis 不可用时降级为不冷却（不静默丢告警）', async () => {
    redis.isReady.mockReturnValue(false);
    await service.createChannel(
      { type: 'wecom', name: '群', config: { webhook: 'https://qyapi.weixin.qq.com/x' } } as unknown as Record<
        string,
        unknown
      >,
      1,
    );
    await service.createRule(
      {
        name: 'r',
        eventType: 'login.bruteForce',
        level: 'warning',
        channelIds: [1],
        cooldownSeconds: 600,
      } as unknown as Record<string, unknown>,
      1,
    );
    await service.publish({ eventType: 'login.bruteForce', level: 'warning', title: 't', message: 'm', dedupKey: 'a' });
    await service.publish({ eventType: 'login.bruteForce', level: 'warning', title: 't', message: 'm', dedupKey: 'a' });
    expect(prisma.__data.records).toHaveLength(2);
    redis.isReady.mockReturnValue(true);
  });

  it('publish：渠道分发异常被吞掉（不抛到业务调用方）', async () => {
    await service.createChannel(
      { type: 'wecom', name: '群', config: { webhook: 'https://qyapi.weixin.qq.com/x' } } as unknown as Record<
        string,
        unknown
      >,
      1,
    );
    await service.createRule(
      {
        name: 'r',
        eventType: 'export.failed',
        level: 'warning',
        channelIds: [1],
        cooldownSeconds: 0,
      } as unknown as Record<string, unknown>,
      1,
    );
    // wecom 会真实请求公网（测试环境不通）→ sendAlert 内部已捕获为失败结果；
    // 这里再极端一点：让 findMany 抛错，publish 也必须静默
    prisma.alertChannel.findMany = vi.fn(async () => {
      throw new Error('db down');
    });
    await expect(
      service.publish({ eventType: 'export.failed', level: 'warning', title: 't', message: 'm' }),
    ).resolves.toBeUndefined();
  });

  it('未配置信封密钥时功能禁用', async () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    expect(service.isEnabled()).toBe(false);
    process.env.SECRETS_ENCRYPTION_KEY = 'd'.repeat(64);
  });
});
