/**
 * 开放 API（API Key + Webhook）服务单测。
 * 覆盖：密钥哈希存储与一次性明文、唯一名校验、签名计算、事件过滤、投递状态。
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SECRETS_ENCRYPTION_KEY = 'e'.repeat(64);
process.env.JWT_ACCESS_SECRET = 'openapi-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'openapi-test-refresh-secret-not-for-production-2';

const { ApiKeyService } = await import('../src/modules/api-key/api-key.service.js');
const { WebhookService } = await import('../src/modules/api-key/webhook.service.js');

describe('ApiKeyService', () => {
  let service: InstanceType<typeof ApiKeyService>;
  let rows: Array<Record<string, unknown>>;
  let idSeq = 1;

  beforeEach(() => {
    rows = [];
    idSeq = 1;
    const store = {
      findMany: vi.fn(async () => rows),
      findFirst: vi.fn(
        async (args: { where: Record<string, unknown> }) =>
          rows.find((row) => Object.entries(args.where).every(([key, value]) => row[key] === value)) ?? null,
      ),
      findUnique: vi.fn(
        async (args: { where: { id: bigint } }) => rows.find((row) => row.id === args.where.id) ?? null,
      ),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const row = { id: BigInt(idSeq++), createdAt: new Date(), ...args.data };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        const row = rows.find((item) => item.id === args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      delete: vi.fn(async (args: { where: { id: bigint } }) => {
        const index = rows.findIndex((item) => item.id === args.where.id);
        if (index < 0) throw new Error('not found');
        return rows.splice(index, 1)[0];
      }),
      count: vi.fn(async () => rows.length),
    };
    // create mock 里补默认 status：Prisma 真实 schema 有 default(1)，mock 需对齐，
    // 否则 Number(undefined)=NaN 会让启停判断永远走错分支
    const originalCreate = store.create;
    store.create = vi.fn(async (args: { data: Record<string, unknown> }) =>
      originalCreate({ data: { status: 1, ...args.data } } as never),
    ) as never;
    const prisma = {
      apiKey: store,
      user: {
        findUnique: vi.fn(async (args: { where: { id: bigint } }) => ({
          id: args.where.id,
          username: 'admin',
          status: 1,
        })),
        findMany: vi.fn(async () => []),
      },
    };
    service = new ApiKeyService(prisma as never);
  });

  it('签发：明文只在创建响应出现一次，库内只存 SHA-256 哈希与前缀', async () => {
    const created = await service.create({ name: 'CI 部署', userId: 1 });
    expect(created.key.startsWith('lyak_')).toBe(true);
    expect(created.key.length).toBeGreaterThan(30);
    const stored = rows[0];
    expect(stored.keyHash).toBe(createHash('sha256').update(created.key).digest('hex'));
    expect(stored.prefix).toBe(created.key.slice(0, 13));
    // 列表 / 详情永不回传明文
    const list = await service.list({});
    expect(JSON.stringify(list.list)).not.toContain(created.key);
    const detail = await service.detail(1);
    expect('key' in detail).toBe(false);
  });

  it('同名同用户重复签发被拒（防止使用方分不清该旋转哪把）', async () => {
    await service.create({ name: 'CI 部署', userId: 1 });
    await expect(service.create({ name: 'CI 部署', userId: 1 })).rejects.toThrow(/同名密钥/);
  });

  it('过期时间早于现在被拒', async () => {
    await expect(
      service.create({ name: 'x', userId: 1, expiresAt: new Date(Date.now() - 60_000).toISOString() }),
    ).rejects.toThrow(/过期时间不能早于当前时间/);
  });

  it('启停切换', async () => {
    await service.create({ name: 'k', userId: 1 });
    const off = await service.toggleStatus(1);
    expect(off.status).toBe(0);
    const on = await service.toggleStatus(1);
    expect(on.status).toBe(1);
  });
});

describe('WebhookService', () => {
  let service: InstanceType<typeof WebhookService>;
  let hooks: Array<Record<string, unknown>>;
  let deliveries: Array<Record<string, unknown>>;
  let idSeq = 1;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    hooks = [];
    deliveries = [];
    idSeq = 1;
    fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const store = {
      webhook: {
        findMany: vi.fn(async (args?: { where?: { status: number } }) =>
          hooks.filter((row) => !args?.where || row.status === args.where.status),
        ),
        findUnique: vi.fn(
          async (args: { where: { id: bigint } }) => hooks.find((row) => row.id === args.where.id) ?? null,
        ),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          // 与 schema default 对齐：status 缺省 1
          const row = { id: BigInt(idSeq++), createdAt: new Date(), status: 1, ...args.data };
          hooks.push(row);
          return row;
        }),
        update: vi.fn(async (args: { where: { id: bigint }; data: Record<string, unknown> }) => {
          const row = hooks.find((item) => item.id === args.where.id);
          if (!row) throw new Error('not found');
          Object.assign(row, args.data);
          return row;
        }),
        delete: vi.fn(async (args: { where: { id: bigint } }) => {
          const index = hooks.findIndex((item) => item.id === args.where.id);
          if (index < 0) throw new Error('not found');
          return hooks.splice(index, 1)[0];
        }),
      },
      webhookDelivery: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const row = { id: BigInt(idSeq++), createdAt: new Date(), ...args.data };
          deliveries.push(row);
          return row;
        }),
        findMany: vi.fn(async () => deliveries),
        count: vi.fn(async () => deliveries.length),
      },
    };
    service = new WebhookService(store as never);
  });

  it('创建订阅：secret 信封加密，列表不回传', async () => {
    const item = await service.create({
      name: 'IM 开通',
      url: 'https://im.example.com/hook',
      events: ['user.created'],
      secret: 'sign-secret',
    });
    expect(item.id).toBe(1);
    const stored = hooks[0].secret as string;
    expect(stored.startsWith('v1:')).toBe(true);
    const list = await service.list();
    expect(JSON.stringify(list)).not.toContain('sign-secret');
  });

  it('publish：只推订阅了该事件的启用中订阅；空 events = 全部', async () => {
    await service.create({ name: 'A', url: 'https://a.example.com', events: ['user.created'], secret: 's1' });
    await service.create({ name: 'B', url: 'https://b.example.com', events: ['export.finished'], secret: 's2' });
    await service.create({ name: 'C', url: 'https://c.example.com', events: [], secret: 's3' });
    fetchMock.mockClear();
    await service.publish({ event: 'user.created', data: { userId: 1 } });
    // A（命中）+ C（全订阅）= 2 次；B 不命中
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toContain('https://a.example.com');
    expect(urls).toContain('https://c.example.com');
    expect(urls).not.toContain('https://b.example.com');
  });

  it('投递带 X-LY-Signature 签名头（HMAC-SHA256 of body）', async () => {
    await service.create({ name: 'A', url: 'https://a.example.com', events: ['user.created'], secret: 'sign-secret' });
    await service.publish({ event: 'user.created', data: { userId: 7 } });
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(init.headers['X-LY-Event']).toBe('user.created');
    expect(init.headers['X-LY-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    // 签名可用同一密钥重算校验（证明接收方能验证）
    const { createHmac } = await import('node:crypto');
    const expected = createHmac('sha256', 'sign-secret').update(init.body).digest('hex');
    expect(init.headers['X-LY-Signature']).toBe(`sha256=${expected}`);
    expect(deliveries[0].status).toBe('ok');
  });

  it('投递失败落库 failed 且不抛出；停用订阅不被推送', async () => {
    await service.create({ name: 'A', url: 'https://a.example.com', events: ['user.created'], secret: 's' });
    await service.create({ name: 'B', url: 'https://b.example.com', events: ['user.created'], secret: 's' });
    // 停用 B
    hooks[1].status = 0;
    fetchMock.mockImplementation(async () => {
      throw new Error('connect timeout');
    });
    await expect(service.publish({ event: 'user.created', data: {} })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deliveries[0].status).toBe('failed');
    expect(deliveries[0].error).toContain('connect timeout');
  });

  it('测试推送写入 webhook.test 事件记录', async () => {
    const created = await service.create({ name: 'A', url: 'https://a.example.com', events: [], secret: 's' });
    const record = await service.test(created.id);
    expect(record.event).toBe('webhook.test');
    expect(record.status).toBe('ok');
  });

  it('未配信封密钥时 publish 静默跳过（功能禁用）', async () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    fetchMock.mockClear();
    await service.publish({ event: 'user.created', data: {} });
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.SECRETS_ENCRYPTION_KEY = 'e'.repeat(64);
  });
});
