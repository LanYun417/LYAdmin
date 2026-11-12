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
import { createTestApp } from './setup-app.js';

const API = '/api';
/** 验证码在 Redis 中的键前缀（见 src/common/auth/captcha.service.ts）。 */
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';
const MAX_DEVICES_KEY = 'sys.login.maxDevices';
const GUEST_ROLE_KEY = 'sys.login.guestRoleCodes';
const ADMIN_USERNAME = 'admin';

/** 一次登录换来的令牌对。 */
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

describe('登录设备并发控制 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;

  /** 登录一次（验证码答案从 Redis 取回填，与 contract e2e 同构）。 */
  async function login(): Promise<TokenPair> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: ADMIN_USERNAME, password: resolveSeedAdminPassword(), captchaId, captchaCode })
      .expect(200);
    return response.body.data as TokenPair;
  }

  /** 用 refreshToken 刷新：200 = 会话仍有效，401 = 已被回收。 */
  async function isSessionAlive(refreshToken: string): Promise<boolean> {
    const response = await request(app.getHttpServer()).post(`${API}/auth/refresh`).send({ refreshToken });
    return response.status === 200;
  }

  /** 测试期间直接改系统参数（恢复在 afterAll 统一做）。 */
  async function setConfig(configKey: string, configValue: string): Promise<void> {
    await prisma.sysConfig.upsert({
      where: { configKey },
      update: { configValue },
      create: { configName: configKey, configKey, configValue, systemFlag: 1 },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    // 复位到默认策略，防止此前用例的改动残留
    await setConfig(MAX_DEVICES_KEY, '3');
    await setConfig(GUEST_ROLE_KEY, 'viewer');
  });

  afterAll(async () => {
    await setConfig(MAX_DEVICES_KEY, '3');
    await setConfig(GUEST_ROLE_KEY, 'viewer');
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
    await setConfig(GUEST_ROLE_KEY, 'super_admin');
    const sessions = [await login(), await login(), await login(), await login(), await login()];

    // 超管命中豁免名单：5 台全部可用
    for (const session of sessions) {
      expect(await isSessionAlive(session.refreshToken)).toBe(true);
    }

    await setConfig(GUEST_ROLE_KEY, 'viewer');
  });

  it('maxDevices = 0：完全关闭限制，登录数不设上限', async () => {
    await setConfig(MAX_DEVICES_KEY, '0');
    const sessions = [await login(), await login(), await login(), await login()];

    for (const session of sessions) {
      expect(await isSessionAlive(session.refreshToken)).toBe(true);
    }

    await setConfig(MAX_DEVICES_KEY, '3');
  });
});
