/**
 * 用户有效菜单解析（RBAC + 用户级覆盖）。
 *
 * 语义：某用户的**有效菜单 id 集合** =（其所有角色的菜单并集 ∪ 额外授予）− 额外撤销。
 * 该口径被两处共用，务必保持同源，否则会出现「有权限码但看不到菜单」或反之：
 * - `AuthUserService`：把有效菜单的 `permission` 汇成权限码（接口级鉴权）；
 * - `MenuService`：把有效菜单构建成侧边栏菜单树（前端动态路由）。
 */
import type { PrismaService } from '../../prisma/prisma.service.js';
import { UserMenuType } from '../config/constants.js';

/** 用户级菜单覆盖记录（已归一为 number）。 */
export interface MenuOverride {
  menuId: number;
  type: number;
}

/** 有效菜单解析结果。 */
export interface EffectiveMenus {
  /** 有效菜单 id 集合 */
  menuIds: Set<number>;
  /** 是否存在用户级覆盖（菜单树缓存键据此决定能否按「角色组合」共享） */
  hasOverride: boolean;
}

/** 读取用户的菜单覆盖记录（grant / revoke）。 */
export async function loadUserMenuOverrides(prisma: PrismaService, userId: number): Promise<MenuOverride[]> {
  const rows = await prisma.userMenu.findMany({
    where: { userId: BigInt(userId) },
    select: { menuId: true, type: true },
  });
  return rows.map((row) => ({ menuId: Number(row.menuId), type: Number(row.type) }));
}

/** 合并有效菜单：角色菜单并集 ∪ GRANT − REVOKE。 */
export function mergeEffectiveMenuIds(roleMenuIds: Iterable<number>, overrides: MenuOverride[]): Set<number> {
  const menuIds = new Set<number>(roleMenuIds);
  overrides.forEach((override) => {
    if (override.type === UserMenuType.GRANT) {
      menuIds.add(override.menuId);
    } else {
      menuIds.delete(override.menuId);
    }
  });
  return menuIds;
}

/**
 * 便捷解析：按 userId + roleIds 计算有效菜单集合。
 *
 * @param prisma Prisma 客户端
 * @param userId 用户 id
 * @param roleIds 用户持有的角色 id（非超管）
 */
export async function resolveEffectiveMenuIds(
  prisma: PrismaService,
  userId: number,
  roleIds: number[],
): Promise<EffectiveMenus> {
  const overrides = await loadUserMenuOverrides(prisma, userId);

  const roleMenuIds = new Set<number>();
  if (roleIds.length > 0) {
    const rows = await prisma.roleMenu.findMany({
      where: { roleId: { in: roleIds.map((id) => BigInt(id)) } },
      select: { menuId: true },
    });
    rows.forEach((row) => roleMenuIds.add(Number(row.menuId)));
  }

  return {
    menuIds: mergeEffectiveMenuIds(roleMenuIds, overrides),
    hasOverride: overrides.length > 0,
  };
}
