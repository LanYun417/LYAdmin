/**
 * 密钥信封（AES-256-GCM）。
 * 模块职责：加密存放「泄露即出事」的短机密——TOTP 种子、SSO clientSecret。
 *
 * 设计取舍：
 * - 为什么不用环境变量直存明文：数据库备份、误开的 debug 页面、慢 SQL 日志都可能带走
 *   表内容；TOTP 种子明文落库 ≈ 所有人的二次验证形同虚设；
 * - 为什么用 GCM：同时提供机密性与完整性，且 Node 原生支持、无需引库；
 * - 格式：`v1:<iv-b64url>:<ciphertext-b64url>:<tag-b64url>`——版本前缀为将来轮换算法留路；
 * - 密钥来自环境变量 `SECRETS_ENCRYPTION_KEY`（32 字节 hex）。**未配置时抛错**：
 *   相关功能（MFA / SSO）直接不可用，好过「用空密钥跑出个假加密」。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** IV 长度（字节）：GCM 推荐 12；密钥恒为 32 字节 AES-256（取自 SECRETS_ENCRYPTION_KEY 的 hex 解码）。 */
const IV_BYTES = 12;

/** 把 hex 环境值转为 32 字节密钥；非法即抛错（fail-fast，拒绝用弱密钥运行）。 */
function loadKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    throw new Error(
      '[SecretBox] 缺少或非法 SECRETS_ENCRYPTION_KEY（需 32 字节 hex）：' +
        "MFA / SSO 等涉及密钥托管的功能已禁用。生成方式：node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(raw.trim(), 'hex');
}

/** 是否已配置信封密钥（供配置中心判断功能是否可用，不抛错）。 */
export function secretsEncryptionAvailable(): boolean {
  return /^[0-9a-fA-F]{64}$/.test((process.env.SECRETS_ENCRYPTION_KEY ?? '').trim());
}

/**
 * 加密明文为 `v1:iv:ct:tag` 信封串。
 * @param plaintext 明文（UTF-8）
 */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${ciphertext.toString('base64url')}:${tag.toString('base64url')}`;
}

/**
 * 解密信封串；格式不符或校验失败（被篡改）抛错。
 * @param envelope `v1:iv:ct:tag`
 */
export function decryptSecret(envelope: string): string {
  const key = loadKey();
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('[SecretBox] 密文格式不符');
  }
  const iv = Buffer.from(parts[1], 'base64url');
  const ciphertext = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
