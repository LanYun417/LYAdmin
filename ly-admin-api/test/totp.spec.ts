/**
 * TOTP 与密钥信封单测（纯函数 + Node crypto，无外部依赖）。
 */
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  base32Decode,
  buildOtpAuthUrl,
  generateTotpSecret,
  TOTP_PERIOD,
  verifyTotp,
} from '../src/common/crypto/totp.js';
import { decryptSecret, encryptSecret, secretsEncryptionAvailable } from '../src/common/crypto/secret-box.js';

describe('TOTP', () => {
  it('生成的密钥是 32 字符 Base32，可被完整解码回 20 字节', () => {
    const secret = generateTotpSecret(randomBytes);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it('RFC 6238 官方测试向量（SHA1/6位/30s）全部通过', () => {
    // RFC 6238 Appendix B: secret = ASCII "12345678901234567890"（Base32: GEZDGNBVGY3TQOJQ…）
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const vectors: Array<[seconds: number, code: string]> = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
    ];
    for (const [seconds, code] of vectors) {
      expect(verifyTotp(secret, code, seconds * 1000)).toBe(true);
    }
    // 窗口外（相邻步的正确码不应通过——窗口 ±1 已覆盖 ±30s，这里取 +5 步）
    const far = verifyTotp(secret, '287082', (59 + 5 * TOTP_PERIOD) * 1000);
    expect(far).toBe(false);
  });

  it('非法输入（格式错 / 密钥错）不会抛错，一律拒绝', () => {
    expect(verifyTotp('not-base32!!', '123456')).toBe(false);
    expect(verifyTotp(generateTotpSecret(randomBytes), '12345')).toBe(false);
    expect(verifyTotp(generateTotpSecret(randomBytes), '12345a')).toBe(false);
  });

  it('otpauth URL 含必要参数', () => {
    const url = buildOtpAuthUrl({ account: 'admin', issuer: 'LYAdmin', secretBase32: 'ABCDEFGH' });
    expect(url).toContain('otpauth://totp/LYAdmin:admin');
    expect(url).toContain('secret=ABCDEFGH');
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });

  it('周期常量为通行口径（30s / 6 位）', () => {
    expect(TOTP_PERIOD).toBe(30);
  });
});

describe('SecretBox', () => {
  const KEY = 'a'.repeat(64);

  beforeEach(() => {
    process.env.SECRETS_ENCRYPTION_KEY = KEY;
  });

  it('加密 → 解密往返一致', () => {
    const envelope = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(envelope.startsWith('v1:')).toBe(true);
    expect(decryptSecret(envelope)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('同一明文两次加密结果不同（随机 IV），但都能解回原文', () => {
    const first = encryptSecret('same-plaintext');
    const second = encryptSecret('same-plaintext');
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe('same-plaintext');
    expect(decryptSecret(second)).toBe('same-plaintext');
  });

  it('密文被篡改时解密抛错（GCM 完整性）', () => {
    const envelope = encryptSecret('tamper-me');
    const parts = envelope.split(':');
    parts[2] = `${parts[2].slice(0, -2)}XX`;
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('未配置密钥时加密抛错，secretsEncryptionAvailable 为 false', () => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
    expect(secretsEncryptionAvailable()).toBe(false);
    expect(() => encryptSecret('x')).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
});
