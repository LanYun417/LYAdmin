/**
 * 鉴权用户服务：加载用户 + 角色码 + 权限码。
 * 模块职责：为鉴权守卫与 /auth/profile 等接口提供统一的用户上下文查询（带 30s 缓存）。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthCacheService } from './auth-cache.service.js';
import { resolveEffectiveMenuIds } from './effective-menu.js';
import { Status, SUPER_ADMIN_ROLE } from '../config/constants.js';
import { lookupDeptName } from '../utils/dept-lookup.js';
import type { AuthContext } from '../types.js';

@Injectable()
export class AuthUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AuthCacheService,
  ) {}

  /**
   * 汇总「有效菜单集合」对应的权限码。
   *
   * 有效菜单由 {@link resolveEffectiveMenuIds} 计算：角色菜单并集 ∪ 额外授予 − 额外撤销。
   * 这里只负责取这些菜单的 permission 字段；不限 menuType（含 F 按钮节点）。
   */
  private async collectPermissions(menuIds: Set<number>): Promise<string[]> {
    if (menuIds.size === 0) {
      return [];
    }
    const menus = await this.prisma.menu.findMany({
      where: {
        status: Status.ENABLED,
        id: { in: Array.from(menuIds).map((menuId) => BigInt(menuId)) },
      },
      select: { permission: true },
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
   * 命中进程内缓存时直接返回（TTL 30s，见 AuthCacheService）。
   * 缓存只存「存在的用户」，不存在时不缓存。
   *
   * @returns 上下文；用户不存在时返回 null
   */
  async loadAuthUser(userId: number): Promise<AuthContext | null> {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    // 角色经显式中间表 sys_user_role 读取（userRoles → role）；
    // 不要用隐式多对多 `roles`：它读的是 Prisma 自建的 _userroles 表，与业务写入的表不通
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: {
        userRoles: { include: { role: { select: { id: true, roleCode: true } } } },
      },
    });
    if (!user) {
      return null;
    }
    const deptName = await lookupDeptName(this.prisma, user.deptId);

    const roles = user.userRoles.map((link) => link.role);
    const roleCodes = roles.map((role) => role.roleCode);
    const roleIds = roles.map((role) => Number(role.id));
    // 超管直通全部权限；其余按「角色并集 ∪ 用户额外授予 − 用户额外撤销」汇总
    const permissions = roleCodes.includes(SUPER_ADMIN_ROLE)
      ? ['*']
      : await this.collectPermissions((await resolveEffectiveMenuIds(this.prisma, Number(user.id), roleIds)).menuIds);

    const context: AuthContext = {
      userId: Number(user.id),
      username: user.username,
      roleCodes,
      permissions,
      status: Number(user.status),
      deptId: Number(user.deptId ?? 0),
      deptName,
      passwordChangedAt: user.passwordChangedAt,
      avatar: user.avatar,
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      lastLoginAt: user.lastLoginAt,
      remark: user.remark,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    this.cache.set(userId, context);
    return context;
  }
}
