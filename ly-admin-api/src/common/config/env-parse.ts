/**
 * 环境变量解析原语。
 *
 * 单独成档的原因：`config.ts` 是**带 fail-fast 校验**的服务端配置中心（缺 JWT 密钥直接抛错），
 * 而某些 CLI 脚本（如 `scripts/prisma-comments.ts`）只需要数据库连接信息。
 * 若让它们 import `config.ts`，就会被服务端的必填项校验拦住——
 * 真实事故：compose 的 `migrate` 服务执行 `prisma:comments` 时因环境里没有 JWT 密钥而退出码 1，
 * 整个部署卡在迁移后一步。故把无副作用的解析函数拆出来，供两边共用。
 */

/** 将字符串布尔值安全转换为 boolean。 */
export function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
}

/** 将字符串数字安全转换为 number。 */
export function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
