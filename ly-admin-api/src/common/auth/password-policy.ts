/**
 * 口令策略（新增用户 / 重置密码 / 自助改密三处共用的唯一口径）。
 *
 * 为什么收敛到一处：口令规则原先散在三个 DTO 里各写一遍 `@MinLength(6)`，
 * 改动时极易漏改一处，导致「新增能过、重置过不了」这类不一致。
 *
 * 规则：
 * 1. 长度 `PASSWORD_MIN_LENGTH ~ PASSWORD_MAX_LENGTH`（默认 8~20，可用环境变量调整）；
 * 2. 复杂度：至少同时包含字母与数字（`PASSWORD_REQUIRE_COMPLEXITY=false` 可关闭）；
 * 3. 不得包含登录账号，也不得被账号包含（`admin` / `admin123` 这类组合一眼可猜），
 *    这条需要跨字段信息，故用服务层断言而非装饰器。
 *
 * ⚠️ 只约束**新设置**的口令。存量账号（含种子 admin）不受影响，登录逻辑不做任何拦截；
 * 种子口令由 `SEED_ADMIN_PASSWORD` 注入，生产环境使用默认值时会打 warn。
 */
import { config } from '../config/config.js';
import { AppException } from '../exception/app.exception.js';

/** 最小长度。 */
export const PASSWORD_MIN_LENGTH = config.password.minLength;

/** 最大长度。 */
export const PASSWORD_MAX_LENGTH = config.password.maxLength;

/**
 * 复杂度正则：要求同时出现字母与数字。
 * 关闭复杂度要求时降级为「任意非空字符」，保持装饰器可用（避免分支散落到调用方）。
 */
export const PASSWORD_COMPLEXITY_REGEX = config.password.requireComplexity ? /^(?=.*[A-Za-z])(?=.*\d).+$/ : /^[\s\S]+$/;

/** 长度提示（消息里带上实际生效的边界，改环境变量后提示自动跟随）。 */
export const PASSWORD_LENGTH_MESSAGE = `密码长度为 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH} 位`;

/** 复杂度提示。 */
export const PASSWORD_COMPLEXITY_MESSAGE = '密码需同时包含字母和数字';

/**
 * 断言口令与登录账号无包含关系（双向）。
 * @param password 明文口令
 * @param username 登录账号（缺省或空则跳过检查）
 * @throws AppException 400 密码不能包含登录账号
 */
export function assertPasswordNotContainsAccount(password: string, username?: string | null): void {
  const account = (username ?? '').trim().toLowerCase();
  if (!account) {
    return;
  }
  const normalized = password.trim().toLowerCase();
  if (normalized.includes(account) || account.includes(normalized)) {
    throw AppException.badRequest('密码不能包含登录账号');
  }
}
