/**
 * 密码工具。
 * 模块职责：封装 bcrypt 哈希与比对，统一加密强度。
 */
import bcrypt from 'bcryptjs';

/** bcrypt 加盐轮数。 */
const SALT_ROUNDS = 10;

/**
 * 生成密码哈希。
 * @param plain 明文密码
 * @returns bcrypt 哈希串
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * 校验明文密码与哈希是否匹配。
 * @param plain 明文密码
 * @param hashed 已存储哈希
 * @returns 是否匹配
 */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  if (!hashed) {
    return false;
  }
  return bcrypt.compare(plain, hashed);
}
