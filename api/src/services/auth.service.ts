/**
 * 认证服务。
 * 模块职责：登录校验、双 Token 签发、刷新、用户权限上下文组装、菜单树下发。
 */
import { Op } from 'sequelize';
import { ERROR_MESSAGE, LogResult, Status, SUPER_ADMIN_ROLE } from '@/constants';
import { LoginLog, Menu, Role, User } from '@/models';
import { getMenusByRoles } from '@/services/menu.service';
import type { JwtPayload, MenuNode, UserBrief } from '@/types';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt';
import { comparePassword } from '@/utils/password';
import { AppError } from '@/utils/response';

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
    status: Number(user.status),
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
 * @param userId 用户 id
 * @returns 上下文；用户不存在时返回 null
 */
export async function loadAuthUser(userId: number): Promise<AuthContext | null> {
  const user = await User.findByPk(userId, { include: [{ model: Role }] });
  if (!user) {
    return null;
  }
  const roles = user.roles ?? [];
  const roleCodes = roles.map((role) => role.roleCode);
  const permissions = await collectPermissions(roleCodes, roles);
  return { user, roleCodes, permissions };
}

/**
 * 登录：校验账号密码与状态，签发双 Token 并写登录日志。
 * @param username 账号
 * @param password 明文密码
 * @param ip 客户端 IP
 * @param userAgent UA
 * @returns 双 Token 与用户简要信息
 */
export async function login(username: string, password: string, ip: string, userAgent: string): Promise<LoginResult> {
  const user = await User.findOne({ where: { username } });
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
 */
export async function getProfile(userId: number): Promise<{ user: UserBrief; roles: string[]; permissions: string[] }> {
  const context = await loadAuthUser(userId);
  if (!context) {
    throw AppError.notFound('用户不存在');
  }
  return {
    user: toUserBrief(context.user),
    roles: context.roleCodes,
    permissions: context.permissions,
  };
}

/**
 * 获取当前用户权限码列表。
 * @param userId 用户 id
 */
export async function getPermissions(userId: number): Promise<string[]> {
  const context = await loadAuthUser(userId);
  if (!context) {
    throw AppError.notFound('用户不存在');
  }
  return context.permissions;
}

/**
 * 获取当前用户菜单树（仅目录/菜单节点）。
 * @param userId 用户 id
 */
export async function getUserMenus(userId: number): Promise<MenuNode[]> {
  const context = await loadAuthUser(userId);
  if (!context) {
    throw AppError.notFound('用户不存在');
  }
  const roleIds = (context.user.roles ?? []).map((role) => Number(role.id));
  return getMenusByRoles(context.roleCodes, roleIds);
}

/**
 * 登出（无状态方案：服务端不维护黑名单，仅作占位）。
 */
export async function logout(): Promise<void> {
  return Promise.resolve();
}
