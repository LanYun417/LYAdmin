/**
 * 登录设备并发控制 e2e（真实 MySQL + Redis）。
 *
 * 验证口径统一为「拿早期会话的 refreshToken 去刷新」：会话被回收后 sid 已从 Redis
 * 删除，刷新接口按 SESSION_REVOKED 拒绝（401）；豁免 / 不限制的场景则全部可刷新。
 *
 * 覆盖三条产品决策：
 * 1. 默认上限 3 台：第 4 次登录回收最旧会话，其余会话不受影响；
 * 2. 访客豁免（guestRoleCodes 命中角色编码）：不限制并发登录；
 * 3. maxDevices = 0：完全关闭限制。
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisService } from '../src/common/redis/redis.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';
import { hashPassword } from '../src/common/utils/utils.js';
import { createTestApp } from './setup-app.js';

const API = '/api';
/** 验证码在 Redis 中的键前缀（见 src/common/auth/captcha.service.ts）。 */
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';
const MAX_DEVICES_KEY = 'sys.login.maxDevices';
const GUEST_ROLE_KEY = 'sys.login.guestRoleCodes';
const ADMIN_USERNAME = 'admin';
/** 设备限制测试专用账号（无角色 → 不命中豁免名单，受设备上限约束）。 */
const LIMIT_USERNAME = 'dev_limit_user';

/** 一次登录换来的令牌对。 */
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

describe('登录设备并发控制 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token: string;
  /** 设备限制测试用户 id（beforeAll 创建，afterAll 删除）。 */
  let limitUserId = 0;

  /** 登录一次（验证码答案从 Redis 取回填，与 contract e2e 同构）。 */
  async function login(username = ADMIN_USERNAME, password = resolveSeedAdminPassword()): Promise<TokenPair> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username, password, captchaId, captchaCode })
      .expect(200);
    return response.body.data as TokenPair;
  }

  /** 用 refreshToken 刷新：200 = 会话仍有效，401 = 已被回收。 */
  async function isSessionAlive(refreshToken: string): Promise<boolean> {
    const response = await request(app.getHttpServer()).post(`${API}/auth/refresh`).send({ refreshToken });
    return response.status === 200;
  }

  /** 测试期间经参数管理接口改配置：ConfigService 写后会失效缓存，避免 5s TTL 让测试读到旧值。 */
  async function setConfigViaApi(configKey: string, configValue: string): Promise<void> {
    // 每次换一个新会话调用：设备上限会回收最旧会话，复用旧 token 随时可能 401
    token = (await login()).accessToken;
    const list = await request(app.getHttpServer())
      .get(`${API}/configs`)
      .set('authorization', `Bearer ${token}`)
      .query({ configKey, page: 1, pageSize: 10 })
      .expect(200);
    const row = (list.body.data.list as Array<{ id: number; configName: string }>)[0];
    expect(row, `参数 ${configKey} 应已由种子写入`).toBeTruthy();
    await request(app.getHttpServer())
      .put(`${API}/configs/${row.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ configName: row.configName, configValue })
      .expect(200);
  }

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    token = (await login()).accessToken;
    // 复位到默认策略（防止此前用例的改动残留；经接口改，缓存同步失效）
    await setConfigViaApi(MAX_DEVICES_KEY, '3');
    await setConfigViaApi(GUEST_ROLE_KEY, 'viewer');
    // 建一个无角色的测试用户，密码与种子 admin 一致（确保通过复杂度校验）
    const created = await prisma.user.create({
      data: {
        username: LIMIT_USERNAME,
        password: await hashPassword(resolveSeedAdminPassword()),
        nickname: LIMIT_USERNAME,
        status: 1,
        deptId: BigInt(0),
      },
    });
    limitUserId = Number(created.id);
  });

  afterAll(async () => {
    // 恢复种子默认值（直改库即可：本应用实例即将关闭，下一个实例缓存是新的）
    await prisma.sysConfig
      .update({ where: { configKey: MAX_DEVICES_KEY }, data: { configValue: '3' } })
      .catch(() => undefined);
    await prisma.sysConfig
      .update({ where: { configKey: GUEST_ROLE_KEY }, data: { configValue: 'viewer' } })
      .catch(() => undefined);
    // 清理测试用户（先清中间表再删用户）
    await prisma.userRole.deleteMany({ where: { userId: BigInt(limitUserId) } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: BigInt(limitUserId) } }).catch(() => undefined);
    await app?.close();
  });

  it('默认上限 3 台：第 4 次登录回收最旧会话，其余会话不受影响', async () => {
    const sessions = [await login(), await login(), await login(), await login()];

    // 第 1 台（最旧）被回收：其 refreshToken 刷新应被拒
    expect(await isSessionAlive(sessions[0]!.refreshToken)).toBe(false);
    // 其余三台照常可用
    expect(await isSessionAlive(sessions[1]!.refreshToken)).toBe(true);
    expect(await isSessionAlive(sessions[2]!.refreshToken)).toBe(true);
    expect(await isSessionAlive(sessions[3]!.refreshToken)).toBe(true);
  });

  it('访客豁免：guestRoleCodes 命中角色编码时不限制并发', async () => {
    await setConfigViaApi(GUEST_ROLE_KEY, 'super_admin');
    const sessions = [await login(), await login(), await login(), await login(), await login()];

    // 超管命中豁免名单：5 台全部可用
    for (const session of sessions) {
      expect(await isSessionAlive(session.refreshToken)).toBe(true);
    }

    await setConfigViaApi(GUEST_ROLE_KEY, 'viewer');
  });

  it('maxDevices = 0：完全关闭限制，登录数不设上限', async () => {
    await setConfigViaApi(MAX_DEVICES_KEY, '0');
    const sessions = [await login(), await login(), await login(), await login()];

    for (const session of sessions) {
      expect(await isSessionAlive(session.refreshToken)).toBe(true);
    }

    await setConfigViaApi(MAX_DEVICES_KEY, '3');
  });

  it('单用户上限优先于全局：maxDevices=1 时第 2 次登录回收最旧会话', async () => {
    // 全局仍为 3；给测试用户单独设 1
    await prisma.user.update({ where: { id: BigInt(limitUserId) }, data: { maxDevices: 1 } });
    // 顺带确认用户详情接口已透传该字段
    token = (await login()).accessToken;
    const detail = await request(app.getHttpServer())
      .get(`${API}/users/${limitUserId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.maxDevices).toBe(1);

    const sessions = [await login(LIMIT_USERNAME), await login(LIMIT_USERNAME)];
    expect(await isSessionAlive(sessions[0]!.refreshToken)).toBe(false);
    expect(await isSessionAlive(sessions[1]!.refreshToken)).toBe(true);

    await prisma.user.update({ where: { id: BigInt(limitUserId) }, data: { maxDevices: null } });
  });

  it('单用户 maxDevices=0：不限制并发（覆盖全局 3）', async () => {
    await prisma.user.update({ where: { id: BigInt(limitUserId) }, data: { maxDevices: 0 } });
    const sessions = [
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
    ];
    for (const session of sessions) {
      expect(await isSessionAlive(session.refreshToken)).toBe(true);
    }
    await prisma.user.update({ where: { id: BigInt(limitUserId) }, data: { maxDevices: null } });
  });

  it('单用户 maxDevices=null：回退全局上限 3', async () => {
    await prisma.user.update({ where: { id: BigInt(limitUserId) }, data: { maxDevices: null } });
    const sessions = [
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
      await login(LIMIT_USERNAME),
    ];
    expect(await isSessionAlive(sessions[0]!.refreshToken)).toBe(false);
    expect(await isSessionAlive(sessions[1]!.refreshToken)).toBe(true);
    expect(await isSessionAlive(sessions[2]!.refreshToken)).toBe(true);
    expect(await isSessionAlive(sessions[3]!.refreshToken)).toBe(true);
  });
});
