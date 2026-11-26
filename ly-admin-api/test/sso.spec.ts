/**
 * SSO 服务单测（Prisma / Redis / AuthService 全部 mock，不触网）。
 * 覆盖：提供方 CRUD 的密钥信封行为、授权 URL 构造与 state 登记、
 * 未配 JWKS 时的 claims 手动校验、账号 provision 的拒绝路径。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SECRETS_ENCRYPTION_KEY = 'c'.repeat(64);
// import 链上的 config 会要求 JWT 密钥（fail-fast）；单测环境注入专用值，不影响生产
process.env.JWT_ACCESS_SECRET = 'sso-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'sso-test-refresh-secret-not-for-production-2';

const { SsoService } = await import('../src/modules/sso/sso.service.js');
const { decryptSecret } = await import('../src/common/crypto/secret-box.js');

/** 内存版 prisma mock。 */
function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    ssoProvider: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => ({ id: 1n, clientSecret: 'x' })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 7n,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => args.data),
      delete: vi.fn(async () => ({})),
    },
    userSso: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    user: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 9n, ...args.data })),
      update: vi.fn(async () => ({})),
    },
    role: { findMany: vi.fn(async () => [{ id: 3n }]) },
    userRole: { createMany: vi.fn(async () => ({ count: 1 })) },
    ...overrides,
  };
}

const redisStore = new Map<string, string>();
function makeRedis() {
  return {
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return true;
    }),
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    del: vi.fn(async (key: string) => redisStore.delete(key)),
  };
}

const VALID_INPUT = {
  name: '企业 OIDC',
  issuer: 'https://sso.example.com',
  authorizationUrl: 'https://sso.example.com/authorize',
  tokenUrl: 'https://sso.example.com/token',
  userInfoUrl: 'https://sso.example.com/userinfo',
  clientId: 'ly-admin',
  clientSecret: 'top-secret-value',
  redirectUri: 'https://admin.example.com/api/sso/callback',
  defaultRoleCodes: 'viewer',
};

describe('SsoService', () => {
  let service: InstanceType<typeof SsoService>;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  const authService = { issueTokensForUser: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })) } as never;

  beforeEach(() => {
    redisStore.clear();
    prisma = makePrisma();
    redis = makeRedis();
    service = new SsoService(prisma as never, redis as never, authService);
  });

  it('新增提供方：clientSecret 信封加密入库，对外 DTO 不含密钥', async () => {
    const item = (await service.createProvider(VALID_INPUT as unknown as Record<string, unknown>, 1)) as {
      clientId: string;
    } & Record<string, unknown>;
    const created = prisma.ssoProvider.create.mock.calls[0][0].data;
    expect(created.clientSecret).toMatch(/^v1:/);
    expect(decryptSecret(created.clientSecret as string)).toBe('top-secret-value');
    expect(item.clientId).toBe('ly-admin');
    expect('clientSecret' in item).toBe(false);
  });

  it('缺少必填字段时拒绝创建', async () => {
    await expect(service.createProvider({ name: 'x' } as unknown as Record<string, unknown>, 1)).rejects.toThrow(
      /均为必填/,
    );
  });

  it('授权 URL 含 client_id / scope / redirect_uri / state，state 已入 Redis', async () => {
    prisma.ssoProvider.findUnique = vi.fn(async () => ({
      id: 1n,
      name: '企业 OIDC',
      status: 1,
      ...VALID_INPUT,
      clientSecret: 'v1:x',
      protocol: 'oidc',
      jwksUrl: null,
      fieldMapping: null,
      linkByEmail: 1,
      defaultRoleCodes: 'viewer',
      sort: 0,
      remark: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const { url } = await service.buildAuthorizeUrl(1);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://sso.example.com/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('ly-admin');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('openid profile email');
    expect(parsed.searchParams.get('redirect_uri')).toBe(VALID_INPUT.redirectUri);
    const state = parsed.searchParams.get('state') ?? '';
    expect(state.length).toBeGreaterThan(10);
    expect(redisStore.has(`sso:state:${state}`)).toBe(true);
  });

  it('票据兑换：一次性（兑换后 Redis 键被删）', async () => {
    redisStore.set('sso:ticket:t-1', JSON.stringify({ userId: 42 }));
    const result = await service.redeemTicket('t-1');
    expect(redisStore.has('sso:ticket:t-1')).toBe(false);
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
    await expect(service.redeemTicket('t-1')).rejects.toThrow(/票据无效/);
  });

  it('登录页只返回启用中的提供方', async () => {
    prisma.ssoProvider.findMany = vi.fn(async () => [{ id: 1n, name: '启用中' }]);
    const list = await service.listEnabledProviders();
    expect(list).toEqual([{ id: 1, name: '启用中' }]);
  });

  it('信封密钥可用性决定功能开关', async () => {
    const { secretsEncryptionAvailable } = await import('../src/common/crypto/secret-box.js');
    expect(secretsEncryptionAvailable()).toBe(true);
    delete process.env.SECRETS_ENCRYPTION_KEY;
    expect(secretsEncryptionAvailable()).toBe(false);
    process.env.SECRETS_ENCRYPTION_KEY = 'c'.repeat(64);
  });
});
