/**
 * LDAP 服务单测（ldapjs 客户端与 Prisma 全部 mock）。
 *
 * 覆盖：配置校验 fail-fast、口令信封加密与脱敏、过滤器模板转义（防注入）、
 * 认证流程（服务账号 bind → 搜索 → 用户 bind）、账号供给（已存在/自动建号/拒绝）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptSecret, encryptSecret } from '../src/common/crypto/secret-box.js';

process.env.SECRETS_ENCRYPTION_KEY = 'f'.repeat(64);
process.env.JWT_ACCESS_SECRET = 'ldap-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'ldap-test-refresh-secret-not-for-production-2';

const ldapMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('ldapjs', () => ({ default: ldapMock, createClient: ldapMock.createClient }));

const { LdapService } = await import('../src/modules/ldap/ldap.service.js');
const { decryptSecret } = await import('../src/common/crypto/secret-box.js');

/** 构造一个可控的 ldapjs client mock（bind/search 结果由句柄控制）。 */
function makeClient(handlers: {
  binds?: Array<{ dn: string; ok: boolean }>;
  search?: { entries: Array<{ dn: string; attrs: Array<{ type: string; values: string[] }> }>; error?: Error };
}) {
  let bindIndex = 0;
  const bindCalls: string[] = [];
  const searchCalls: Array<{ base: string; filter: string; scope: string }> = [];
  const client = {
    bind: (dn: string, _pw: string, cb: (e: Error | null) => void) => {
      bindCalls.push(dn);
      const expected = handlers.binds?.[bindIndex] ?? { dn, ok: true };
      bindIndex += 1;
      cb(expected.ok ? null : new Error(`bind failed for ${dn}`));
    },
    search: (base: string, opts: { filter: string; scope: string }, cb: (e: Error | null, res: unknown) => void) => {
      searchCalls.push({ base, filter: opts.filter, scope: opts.scope });
      if (handlers.search?.error) {
        cb(null, { on: () => undefined });
        return;
      }
      const entries = (handlers.search?.entries ?? []).map((entry) => ({
        dn: { toString: () => entry.dn },
        attributes: entry.attrs,
      }));
      const res = {
        on: (event: string, fn: (arg: unknown) => void) => {
          if (event === 'searchEntry') {
            entries.forEach((entry) => fn(entry));
          }
          if (event === 'end') {
            fn(undefined);
          }
        },
      };
      cb(null, res);
    },
    unbind: () => undefined,
  };
  return { client, bindCalls, searchCalls };
}

/** 有效的保存配置输入。 */
function validInput(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    url: 'ldap://ldap.example.com',
    bindDn: 'cn=admin,dc=example,dc=com',
    bindPassword: 'secret123',
    baseDn: 'ou=users,dc=example,dc=com',
    userFilter: '(uid={{username}})',
    usernameAttr: 'uid',
    emailAttr: 'mail',
    nicknameAttr: 'displayName',
    defaultRoleCodes: 'viewer',
    ...overrides,
  };
}

describe('LdapService 配置', () => {
  let service: InstanceType<typeof LdapService>;
  let row: Record<string, unknown> | null;

  beforeEach(() => {
    row = null;
    ldapMock.createClient.mockReset();
    const prisma = {
      ldapConfig: {
        findUnique: vi.fn(async () => row),
        upsert: vi.fn(async (args: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
          if (row) {
            // Prisma update 是列级合并：未提供的列保留原值（这正是「口令留空不覆盖」要验证的行为）
            row = { ...row, ...args.update, updatedAt: new Date() };
          } else {
            row = { id: 1, updatedAt: new Date(), ...args.create };
          }
          return row;
        }),
        // deleteMany 命中单例行时抹除（无行则静默，保证 clearConfig 幂等）
        deleteMany: vi.fn(async () => {
          const had = row !== null;
          row = null;
          return { count: had ? 1 : 0 };
        }),
      },
    };
    service = new LdapService(prisma as never);
  });

  it('保存成功：口令信封加密，视图只回 hasPassword', async () => {
    const view = await service.saveConfig(validInput());
    expect(view.hasPassword).toBe(true);
    // 信封密文带随机 IV：只校验格式前缀与「可解回原文」，不比对密文等值
    expect(String(row?.bindPassword)).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(decryptSecret(String(row?.bindPassword))).toBe('secret123');
    expect(view.url).toBe('ldap://ldap.example.com');
    expect(view.usernameAttr).toBe('uid');
  });

  it('编辑时口令留空：不覆盖原密文', async () => {
    await service.saveConfig(validInput());
    const original = row?.bindPassword;
    await service.saveConfig(validInput({ bindPassword: '', url: 'ldap://new.example.com' }));
    expect(row?.bindPassword).toBe(original);
    expect(row?.url).toBe('ldap://new.example.com');
  });

  it('配置校验：url 非 ldap(s) / 缺 bindDn / 缺 baseDn / 过滤器无占位符 / 非法字符全部拒绝', async () => {
    await expect(service.saveConfig(validInput({ url: 'http://x.com' }))).rejects.toThrow(/ldap:\/\/ 或 ldaps/);
    await expect(service.saveConfig(validInput({ bindDn: '' }))).rejects.toThrow(/服务账号 DN/);
    await expect(service.saveConfig(validInput({ baseDn: '' }))).rejects.toThrow(/基准 DN/);
    await expect(service.saveConfig(validInput({ userFilter: '(uid=abc)' }))).rejects.toThrow(/占位符/);
    await expect(service.saveConfig(validInput({ userFilter: '(uid={{username}})(|(x))' }))).rejects.toThrow(
      /非法字符/,
    );
  });

  it('未初始化时 getConfig 返回「未配置 + 停用」默认视图', async () => {
    const view = await service.getConfig();
    expect(view.enabled).toBe(false);
    expect(view.hasPassword).toBe(false);
    expect(view.updatedAt).toBeNull();
  });

  it('停用时允许全部留空（关掉并清空表单，不再被必填校验卡住）', async () => {
    const view = await service.saveConfig(
      validInput({ enabled: false, url: '', bindDn: '', baseDn: '', bindPassword: '' }),
    );
    expect(view.enabled).toBe(false);
    expect(view.url).toBe('');
    expect(view.bindDn).toBe('');
    expect(view.baseDn).toBe('');
    // 停用但填了内容：仍校验格式（URL scheme 白名单不放行）
    await expect(service.saveConfig(validInput({ enabled: false, url: 'http://x.com' }))).rejects.toThrow(
      /ldap:\/\/ 或 ldaps/,
    );
  });

  it('clearConfig：整行删除，口令一并抹除（不留「关了但密钥还躺在库里」的尾巴）', async () => {
    await service.saveConfig(validInput());
    expect(row?.bindPassword).toBeTruthy();

    await service.clearConfig();
    expect(row).toBeNull();

    const view = await service.getConfig();
    expect(view.enabled).toBe(false);
    expect(view.hasPassword).toBe(false);

    // 幂等：重复清空 = 静默成功
    await expect(service.clearConfig()).resolves.toBeUndefined();
  });
});

describe('LdapService 认证', () => {
  let service: InstanceType<typeof LdapService>;
  let row: Record<string, unknown>;
  let userRow: Record<string, unknown> | null;

  beforeEach(() => {
    row = {
      id: 1,
      enabled: true,
      url: 'ldap://ldap.example.com',
      bindDn: 'cn=admin,dc=example,dc=com',
      bindPassword: secretStub('admin-pw'),
      baseDn: 'ou=users,dc=example,dc=com',
      userFilter: '(uid={{username}})',
      usernameAttr: 'uid',
      emailAttr: 'mail',
      nicknameAttr: 'displayName',
      defaultRoleCodes: 'viewer',
      startTls: false,
      verifyCert: true,
    };
    userRow = null;
    ldapMock.createClient.mockReset();
    const prisma = {
      ldapConfig: { findUnique: vi.fn(async () => row) },
      user: {
        findUnique: vi.fn(async () => userRow),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          userRow = { id: 42n, status: 1, ...args.data };
          return userRow;
        }),
      },
      role: { findMany: vi.fn(async () => [{ id: 3n }]) },
      userRole: { createMany: vi.fn(async () => ({ count: 1 })) },
    };
    service = new LdapService(prisma as never);
  });

  it('未启用 / 未配置口令 → 直接返回 null（调用方走本地口令）', async () => {
    row.enabled = false;
    expect(await service.authenticate('u', 'p')).toBeNull();
    row.enabled = true;
    row.bindPassword = '';
    expect(await service.authenticate('u', 'p')).toBeNull();
  });

  it('认证成功：服务账号 bind → 搜索（subtree）→ 用户 bind，属性按映射提取', async () => {
    const { client, bindCalls, searchCalls } = makeClient({
      binds: [
        { dn: 'cn=admin,dc=example,dc=com', ok: true },
        { dn: 'uid=alice,ou=users,dc=example,dc=com', ok: true },
      ],
      search: {
        entries: [
          {
            dn: 'uid=alice,ou=users,dc=example,dc=com',
            attrs: [
              { type: 'uid', values: ['alice'] },
              { type: 'mail', values: ['alice@example.com'] },
              { type: 'displayName', values: ['Alice'] },
            ],
          },
        ],
      },
    });
    ldapMock.createClient.mockReturnValue(client);

    const info = await service.authenticate('alice', 'user-pw');
    expect(info).toEqual({
      username: 'alice',
      email: 'alice@example.com',
      nickname: 'Alice',
      dn: 'uid=alice,ou=users,dc=example,dc=com',
    });
    // bind 顺序：先服务账号、再用户
    expect(bindCalls).toEqual(['cn=admin,dc=example,dc=com', 'uid=alice,ou=users,dc=example,dc=com']);
    // 搜索条件：subtree + 转义后的过滤器
    expect(searchCalls[0].scope).toBe('sub');
    expect(searchCalls[0].filter).toBe('(uid=alice)');
  });

  it('口令错误（用户 bind 失败）→ 返回 null', async () => {
    const { client } = makeClient({
      binds: [
        { dn: 'cn=admin,dc=example,dc=com', ok: true },
        { dn: 'uid=alice,ou=users,dc=example,dc=com', ok: false },
      ],
      search: {
        entries: [{ dn: 'uid=alice,ou=users,dc=example,dc=com', attrs: [{ type: 'uid', values: ['alice'] }] }],
      },
    });
    ldapMock.createClient.mockReturnValue(client);
    expect(await service.authenticate('alice', 'bad')).toBeNull();
  });

  it('搜索无命中 → null', async () => {
    const { client } = makeClient({ search: { entries: [] } });
    ldapMock.createClient.mockReturnValue(client);
    expect(await service.authenticate('nobody', 'p')).toBeNull();
  });

  it('搜索命中多条 → 拒绝（拒绝而非猜一个）', async () => {
    const { client } = makeClient({
      search: {
        entries: [
          { dn: 'uid=a,ou=users,dc=example,dc=com', attrs: [{ type: 'uid', values: ['a'] }] },
          { dn: 'uid=a,ou=people,dc=example,dc=com', attrs: [{ type: 'uid', values: ['a'] }] },
        ],
      },
    });
    ldapMock.createClient.mockReturnValue(client);
    expect(await service.authenticate('a', 'p')).toBeNull();
  });

  it('过滤器注入转义：`*)(uid=*` 被转义为字面量', async () => {
    const { client, searchCalls } = makeClient({
      search: {
        entries: [{ dn: 'uid=x,ou=users,dc=example,dc=com', attrs: [{ type: 'uid', values: ['x'] }] }],
      },
    });
    ldapMock.createClient.mockReturnValue(client);
    await service.authenticate('*)(uid=*', 'p');
    // RFC 4515 转义：* → \2a、( → \28、) → \29
    expect(searchCalls[0].filter).toBe('(uid=\\2a\\29\\28uid=\\2a)');
  });

  it('ensureLocalUser：本地已存在 → 返回其 id 且不覆盖口令', async () => {
    userRow = { id: 7n, status: 1 };
    const id = await service.ensureLocalUser({ username: 'alice', email: 'a@x.com', nickname: 'A', dn: 'uid=alice' });
    expect(id).toBe(7);
  });

  it('ensureLocalUser：本地不存在 → 按 defaultRoleCodes 自动建号', async () => {
    const id = await service.ensureLocalUser({ username: 'newbie', email: 'n@x.com', nickname: 'N', dn: 'uid=newbie' });
    expect(id).toBe(42);
    expect(userRow?.username).toBe('newbie');
    expect(userRow?.remark).toBe('LDAP 目录用户');
  });

  it('ensureLocalUser：未配默认角色 → 拒绝建号', async () => {
    row.defaultRoleCodes = '';
    await expect(service.ensureLocalUser({ username: 'x', email: null, nickname: null, dn: 'uid=x' })).rejects.toThrow(
      /未配置默认角色/,
    );
  });

  it('ensureLocalUser：本地账号被禁用 → 抛 401', async () => {
    userRow = { id: 7n, status: 0 };
    await expect(
      service.ensureLocalUser({ username: 'alice', email: null, nickname: null, dn: 'uid=alice' }),
    ).rejects.toThrow(/禁用/);
  });
});

/** 构造信封密文（复用 encryptSecret 的真实输出）。 */
function secretStub(plain: string): string {
  return encryptSecret(plain);
}
