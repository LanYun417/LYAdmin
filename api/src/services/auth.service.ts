/**
 * 认证服务。
 * 模块职责：登录校验、双 Token 签发、刷新、用户权限上下文组装、菜单树下发。
 */
import { Op } from 'sequelize';
import { ERROR_MESSAGE, LogResult, Status, SUPER_ADMIN_ROLE } from '@/constants';
import { LoginLog, Dept, Menu, Role, User } from '@/models';
import { getCachedAuthContext, invalidateAuthCache, setCachedAuthContext } from '@/services/authCache';
import { verifyCaptcha } from '@/services/captcha.service';
import { getMenusByRoles } from '@/services/menu.service';
import type { JwtPayload, MenuNode, UserBrief } from '@/types';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt';
import { comparePassword } from '@/utils/password';
import { AppError } from '@/utils/response';
import { isTokenRevoked, recordLogout } from '@/services/tokenBlacklist';

// 对外统一从 auth 服务导出缓存失效能力（实现见 `services/authCache.ts`）：
// 写操作触发权限变更时调用，详见 authCache.ts 顶部的失效点清单。
export { invalidateAuthCache } from '@/services/authCache';

/** 鉴权上下文（供中间件使用）。 */
export interface AuthContext {
  user: User;
  roleCodes: string[];
  permissions: string[];
}

/** 登录结果。 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

/** Token 对。 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * 将 User 实例转换为对外简要信息。
 * @param user 用户实例
 * @returns 用户简要信息
 */
export function toUserBrief(user: User): UserBrief {
  return {
    id: Number(user.id),
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    email: user.email,
    phone: user.phone,
    gender: user.gender ?? null,
    status: Number(user.status),
    deptId: Number(user.deptId ?? 0),
    // 关联未加载时为 null（历史行为）；已 include Dept 时（登录、鉴权上下文）返回真实部门名
    deptName: user.dept?.deptName ?? null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.get('createdAt') as Date,
    updatedAt: user.get('updatedAt') as Date,
  };
}

/** 写入登录日志。 */
async function writeLoginLog(
  username: string,
  ip: string,
  userAgent: string,
  status: LogResult,
  message: string,
): Promise<void> {
  try {
    await LoginLog.create({
      username,
      ip,
      userAgent,
      status,
      message,
      loginAt: new Date(),
    });
  } catch (error) {
    console.error('[AuthService] 写入登录日志失败:', error);
  }
}

/**
 * 汇总角色对应的权限码。
 * 超管返回 `['*']`（前端视为拥有全部权限）。
 */
async function collectPermissions(roleCodes: string[], roles: Role[]): Promise<string[]> {
  if (roleCodes.includes(SUPER_ADMIN_ROLE)) {
    return ['*'];
  }
  const roleIds = roles.map((role) => Number(role.id));
  if (roleIds.length === 0) {
    return [];
  }
  const menus = await Menu.findAll({
    attributes: ['permission'],
    where: { status: Status.ENABLED },
    include: [
      {
        model: Role,
        attributes: [],
        through: { attributes: [] },
        where: { id: { [Op.in]: roleIds } },
        required: true,
      },
    ],
  });
  const permissionSet = new Set<string>();
  menus.forEach((menu) => {
    if (menu.permission) {
      permissionSet.add(menu.permission);
    }
  });
  return Array.from(permissionSet);
}

/**
 * 加载用户鉴权上下文（角色码 + 权限码），供鉴权中间件使用。
 *
 * 命中进程内缓存时直接返回，避免每个鉴权请求都查库（见 `services/authCache.ts`）。
 * 缓存 TTL 30 秒，且在上游写操作时主动失效；缓存只存「存在的用户」，不存在时不缓存。
 * @param userId 用户 id
 * @returns 上下文；用户不存在时返回 null
 */
export async function loadAuthUser(userId: number): Promise<AuthContext | null> {
  const cached = getCachedAuthContext(userId);
  if (cached) {
    return cached;
  }

  // 顺带加载部门：供个人中心展示与 HTTP 访问日志的部门快照使用。
  // 本函数结果有 30s 进程内缓存（authCache），实际每 30 秒才多这一次 JOIN，对鉴权耗时影响可忽略。
  const user = await User.findByPk(userId, { include: [{ model: Role }, { model: Dept, attributes: ['deptName'] }] });
  if (!user) {
    return null;
  }
  const roles = user.roles ?? [];
  const roleCodes = roles.map((role) => role.roleCode);
  const permissions = await collectPermissions(roleCodes, roles);
  const context: AuthContext = { user, roleCodes, permissions };
  setCachedAuthContext(userId, context);
  return context;
}

/**
 * 登录：校验图形验证码、账号密码与状态，签发双 Token 并写登录日志。
 * @param username 账号
 * @param password 明文密码
 * @param captchaId 图形验证码 id（验证码关闭时可缺省）
 * @param captchaCode 用户输入的验证码（验证码关闭时可缺省）
 * @param ip 客户端 IP
 * @param userAgent UA
 * @returns 双 Token 与用户简要信息
 */
export async function login(
  username: string,
  password: string,
  captchaId: string | undefined,
  captchaCode: string | undefined,
  ip: string,
  userAgent: string,
): Promise<LoginResult> {
  // 图形验证码：先校验（廉价、无 DB 查询），失败直接拒绝，避免爆破请求消耗数据库
  if (!(await verifyCaptcha(captchaId, captchaCode))) {
    throw AppError.badRequest('验证码错误或已过期');
  }

  // include Dept：登录响应要带上真实部门名（个人中心来源之一）
  const user = await User.findOne({ where: { username }, include: [{ model: Dept, attributes: ['deptName'] }] });
  if (!user) {
    await writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.LOGIN_FAILED);
    throw AppError.unauthorized(ERROR_MESSAGE.LOGIN_FAILED);
  }

  const matched = await comparePassword(password, user.password);
  if (!matched) {
    await writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.LOGIN_FAILED);
    throw AppError.unauthorized(ERROR_MESSAGE.LOGIN_FAILED);
  }

  if (Number(user.status) !== Status.ENABLED) {
    await writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.ACCOUNT_DISABLED);
    throw AppError.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
  }

  await user.update({ lastLoginAt: new Date() });
  await writeLoginLog(username, ip, userAgent, LogResult.SUCCESS, '登录成功');
  // 登录会更新 lastLoginAt：失效该用户鉴权缓存，避免 /auth/profile 在 TTL 内返回陈旧 lastLoginAt
  invalidateAuthCache(Number(user.id));

  const payload = { userId: Number(user.id), username: user.username };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: toUserBrief(user),
  };
}

/**
 * 刷新 Token：校验 refreshToken、用户状态与改密时间，签发新 Token 对。
 * @param refreshToken 刷新令牌
 * @returns 新 Token 对
 */
export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('刷新令牌无效或已过期');
  }

  const user = await User.findByPk(Number(payload.userId));
  if (!user) {
    throw AppError.unauthorized('用户不存在');
  }
  if (await isTokenRevoked(Number(user.id), payload.iat)) {
    throw AppError.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
  }
  if (Number(user.status) !== Status.ENABLED) {
    throw AppError.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
  }
  if (user.passwordChangedAt && payload.iat * 1000 < new Date(user.passwordChangedAt).getTime()) {
    throw AppError.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
  }

  const nextPayload = { userId: Number(user.id), username: user.username };
  return {
    accessToken: signAccessToken(nextPayload),
    refreshToken: signRefreshToken(nextPayload),
  };
}

/**
 * 获取当前用户信息（用户 + 角色码 + 权限码）。
 * @param userId 用户 id
 * @param context 已加载的鉴权上下文（由鉴权中间件挂到 `req.authContext`）；传入时直接复用，避免重复查库
 */
export async function getProfile(
  userId: number,
  context?: AuthContext | null,
): Promise<{ user: UserBrief; roles: string[]; permissions: string[] }> {
  const ctx = context ?? (await loadAuthUser(userId));
  if (!ctx) {
    throw AppError.notFound('用户不存在');
  }
  return {
    user: toUserBrief(ctx.user),
    roles: ctx.roleCodes,
    permissions: ctx.permissions,
  };
}

/**
 * 获取当前用户权限码列表。
 * @param userId 用户 id
 * @param context 已加载的鉴权上下文（复用中间件结果，避免重复查库）
 */
export async function getPermissions(userId: number, context?: AuthContext | null): Promise<string[]> {
  const ctx = context ?? (await loadAuthUser(userId));
  if (!ctx) {
    throw AppError.notFound('用户不存在');
  }
  return ctx.permissions;
}

/**
 * 获取当前用户菜单树（仅目录/菜单节点）。
 * @param userId 用户 id
 * @param context 已加载的鉴权上下文（复用中间件结果，避免重复查库）
 */
export async function getUserMenus(userId: number, context?: AuthContext | null): Promise<MenuNode[]> {
  const ctx = context ?? (await loadAuthUser(userId));
  if (!ctx) {
    throw AppError.notFound('用户不存在');
  }
  const roleIds = (ctx.user.roles ?? []).map((role) => Number(role.id));
  return getMenusByRoles(ctx.roleCodes, roleIds);
}

/**
 * 登出：在 Redis 记录该用户的登出时间，使其此前签发的令牌（access/refresh）立即失效。
 * 依赖 Redis；Redis 不可用/未配置时静默降级（不写入黑名单，接口仍返回成功）。
 * @param userId 用户 ID（由鉴权中间件从令牌解析并挂载到 `req.user`）
 */
export async function logout(userId: number): Promise<void> {
  await recordLogout(userId);
}
