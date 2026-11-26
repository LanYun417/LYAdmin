/**
 * TOTP 动态口令（RFC 6238 / RFC 4226）。
 * 模块职责：基于 HMAC-SHA1 的 6 位动态码生成与校验，零第三方依赖。
 *
 * 为什么不引 otplib：TOTP 算法本身只有几十行（HMAC + 大端计数 + 动态截断），
 * 引库只为一个函数不划算；参数固定为业界通行口径（SHA1 / 6 位 / 30s / ±1 窗口），
 * 与 Google Authenticator、1Password、Authy 等全部兼容。
 */
import { createHmac } from 'node:crypto';

/** 密钥长度（字节）。160 bit 与 SHA1 输出等宽，RFC 4226 推荐。 */
export const TOTP_SECRET_BYTES = 20;
/** 动态码位数。 */
export const TOTP_DIGITS = 6;
/** 步长（秒）。 */
export const TOTP_PERIOD = 30;
/** 校验窗口（±N 步）：容忍客户端时钟偏移与用户输入延迟。 */
export const TOTP_WINDOW = 1;

/** Base32 编码（RFC 4648 字母表，无填充——authenticator 应用的通用格式）。 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 随机生成 Base32 密钥（20 字节 → 128 bit 强度，Base32 后 32 字符）。 */
export function generateTotpSecret(randomBytes: (size: number) => Buffer): string {
  const bytes = randomBytes(TOTP_SECRET_BYTES);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Base32 解码（容错：忽略连字符/空格与填充，大小写不敏感）。 */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[-\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('非 Base32 字符');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 计算某个时间步的 HOTP 码（RFC 4226 动态截断）。 */
function hotp(secret: Buffer, counter: bigint): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (code % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * 校验动态码：在 ±window 步内任一匹配即通过。
 * @param secretBase32 Base32 密钥
 * @param code 用户输入的 6 位码
 * @param nowMillis 当前时间（可注入，测试用）
 */
export function verifyTotp(secretBase32: string, code: string, nowMillis: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }
  const counter = BigInt(Math.floor(nowMillis / 1000 / TOTP_PERIOD));
  for (let step = -TOTP_WINDOW; step <= TOTP_WINDOW; step += 1) {
    if (timingSafeEqualStr(hotp(secret, counter + BigInt(step)), code)) {
      return true;
    }
  }
  return false;
}

/** 生成 otpauth:// URI（用户可手动导入 authenticator 应用，或转成二维码）。 */
export function buildOtpAuthUrl(input: { account: string; issuer: string; secretBase32: string }): string {
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  const label = encodeURIComponent(`${input.issuer}:${input.account}`).replace('%3A', ':');
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, '%20')}`;
}

/** 常量时间比较（避免时序侧信道；长度不同直接 false）。 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
