/**
 * 多因素认证（TOTP）e2e（真实 MySQL + Redis）。
 *
 * 覆盖全链路：绑定（setup → enable）→ 登录挑战（mfaRequired + mfaToken）→
 * 动态码换令牌 → 错误码拒绝 → 恢复码一次性核销 → 挑战令牌不能当访问令牌 → 解绑。
 *
 * 信封密钥在 beforeAll 里注入：config.ts 在模块加载时读取，必须在 import
 * AppModule（setup-app）之前设置，否则 MFA 功能整体禁用。
 */
import { createHmac } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisService } from '../src/common/redis/redis.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashPassword } from '../src/common/utils/utils.js';

const API = '/api';
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';
/** 测试专用账号（无角色，口令即种子默认值；beforeAll 创建，afterAll 删除）。 */
const TEST_USERNAME = 'mfa_e2e_user';
const TEST_PASSWORD = '123456';

/** 当前时间步的 6 位动态码（按 RFC 4226 独立实现，与服务端同算法）。 */
function currentTotpCode(secretBase32: string, nowMillis = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secretBase32.toUpperCase().replace(/[-\s=]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const secret = Buffer.from(bytes);
  const counter = BigInt(Math.floor(nowMillis / 1000 / 30));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

describe('多因素认证 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let testUserId = 0n;

  beforeAll(async () => {
    process.env.SECRETS_ENCRYPTION_KEY = 'b'.repeat(64);
    const { createTestApp } = await import('./setup-app.js');
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    // 自建账号：不依赖 admin 口令（线上/本地库的 admin 口令各不相同）
    const user = await prisma.user.create({
      data: {
        username: TEST_USERNAME,
        password: await hashPassword(TEST_PASSWORD),
        nickname: TEST_USERNAME,
        status: 1,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma?.userMfa.deleteMany({ where: { id: testUserId } });
    await prisma?.user.deleteMany({ where: { id: testUserId } });
    await app?.close();
  });

  /** 登录（验证码答案从 Redis 取回填）。 */
  async function login(username = TEST_USERNAME, password = TEST_PASSWORD) {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }
    return request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username, password, captchaId, captchaCode })
      .expect(200);
  }

  /** 取一个可用的 accessToken（顺手清掉可能残留的绑定）。 */
  async function adminToken(): Promise<string> {
    // 先尝试解绑（幂等）：上一次跑失败的用例可能留下绑定
    const loginResponse = await login();
    const data = loginResponse.body.data as { accessToken?: string; mfaRequired?: boolean; mfaToken?: string };
    if (data.accessToken) {
      await request(app.getHttpServer())
        .post(`${API}/mfa/disable`)
        .set('authorization', `Bearer ${data.accessToken}`)
        .send({ password: TEST_PASSWORD });
      return data.accessToken;
    }
    // 残留绑定：用恢复码之外的路走不通，只能提示人工清理
    throw new Error(`账号存在残留 MFA 绑定（mfaToken=${Boolean(data.mfaToken)}），请先人工解绑`);
  }

  it('绑定 → 挑战登录 → 动态码换令牌 → 解绑全链路', async () => {
    const token = await adminToken();

    // 初始状态：未绑定
    const status = await request(app.getHttpServer())
      .get(`${API}/mfa/status`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(status.body.data.enabled).toBe(false);

    // 开始绑定：返回种子与 otpauth URL
    const setup = await request(app.getHttpServer())
      .post(`${API}/mfa/setup`)
      .set('authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD })
      .expect(200);
    const secret = setup.body.data.secret as string;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.body.data.otpauthUrl).toContain('otpauth://totp/');

    // 未确认前仍是未启用
    const pending = await request(app.getHttpServer())
      .get(`${API}/mfa/status`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(pending.body.data.pending).toBe(true);

    // 错误动态码不能启用
    await request(app.getHttpServer())
      .post(`${API}/mfa/enable`)
      .set('authorization', `Bearer ${token}`)
      .send({ code: '000000' })
      .expect(400);

    // 正确动态码启用，返回 10 个一次性恢复码
    const enabled = await request(app.getHttpServer())
      .post(`${API}/mfa/enable`)
      .set('authorization', `Bearer ${token}`)
      .send({ code: currentTotpCode(secret) })
      .expect(200);
    const recoveryCodes = enabled.body.data as string[];
    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // 再次登录：不再直接给令牌，而是挑战
    const challenged = await login();
    const challenge = challenged.body.data as { mfaRequired?: boolean; mfaToken?: string; accessToken?: string };
    expect(challenge.mfaRequired).toBe(true);
    expect(challenge.mfaToken).toBeTruthy();
    expect(challenge.accessToken).toBeUndefined();

    // 挑战令牌不能当访问令牌用（防「5 分钟窗口绕过二次验证」）
    await request(app.getHttpServer())
      .get(`${API}/auth/profile`)
      .set('authorization', `Bearer ${challenge.mfaToken}`)
      .expect(401);

    // 错误动态码 / 错误恢复码都被拒
    await request(app.getHttpServer())
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: challenge.mfaToken, code: '000000' })
      .expect(401);

    // 恢复码换令牌（一次性）
    const recovered = await request(app.getHttpServer())
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: challenge.mfaToken, code: recoveryCodes[0] })
      .expect(200);
    expect(recovered.body.data.accessToken).toBeTruthy();
    expect(recovered.body.data.refreshToken).toBeTruthy();

    // 恢复码复用 → 拒绝
    await request(app.getHttpServer())
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: challenge.mfaToken, code: recoveryCodes[0] })
      .expect(401);

    // 动态码路径再次登录（新挑战）
    const second = await login();
    const secondChallenge = second.body.data as { mfaToken: string };
    const verified = await request(app.getHttpServer())
      .post(`${API}/auth/mfa/verify`)
      .send({ mfaToken: secondChallenge.mfaToken, code: currentTotpCode(secret) })
      .expect(200);
    expect(verified.body.data.accessToken).toBeTruthy();

    // 解绑需要登录口令
    await request(app.getHttpServer())
      .post(`${API}/mfa/disable`)
      .set('authorization', `Bearer ${verified.body.data.accessToken}`)
      .send({ password: 'wrong-password' })
      .expect(401);

    const disabled = await request(app.getHttpServer())
      .post(`${API}/mfa/disable`)
      .set('authorization', `Bearer ${verified.body.data.accessToken}`)
      .send({ password: TEST_PASSWORD })
      .expect(200);
    expect(disabled.body.data).toBeNull();

    // 解绑后恢复直接登录
    const plain = await login();
    expect(plain.body.data.accessToken).toBeTruthy();
    expect(plain.body.data.mfaRequired).toBeUndefined();
  });
});
