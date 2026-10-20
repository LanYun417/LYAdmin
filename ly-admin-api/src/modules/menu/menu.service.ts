/**
 * 菜单服务。
 * 模块职责：菜单树查询、按角色过滤下发的菜单（供动态路由）、菜单 CRUD、防成环校验。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { loadUserMenuOverrides, mergeEffectiveMenuIds, type MenuOverride } from '../../common/auth/effective-menu.js';
import { MenuType, Status, SUPER_ADMIN_ROLE } from '../../common/config/constants.js';
import { buildTree, readNumber, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MenuNode } from '../../common/types.js';
import type { MenuUpsertDto } from './dto/menu.dto.js';

/** 菜单写入字段（新增与编辑共用）。 */
interface MenuWriteData {
  parentId: bigint;
  menuName: string;
  menuType: string;
  path: string | null;
  component: string | null;
  icon: string | null;
  permission: string | null;
  sort: number;
  visible: number;
  status: number;
  redirect: string | null;
  keepAlive: number;
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
  ) {}

  /** Prisma 菜单记录 → MenuNode DTO。 */
  toMenuNode(menu: {
    id: bigint;
    parentId: bigint;
    menuName: string;
    menuType: string;
    path: string | null;
    component: string | null;
    icon: string | null;
    permission: string | null;
    sort: number;
    visible: number;
    status: number;
    redirect: string | null;
    keepAlive: number;
  }): MenuNode {
    return {
      id: Number(menu.id),
      parentId: Number(menu.parentId),
      menuName: menu.menuName,
      menuType: menu.menuType,
      path: menu.path,
      component: menu.component,
      icon: menu.icon,
      permission: menu.permission,
      sort: menu.sort,
      visible: menu.visible,
      status: menu.status,
      redirect: menu.redirect,
      keepAlive: menu.keepAlive,
    };
  }

  /**
   * 按用户查询菜单树（供 /auth/menus 下发，供前端生成动态路由）。
   *
   * 与「按角色」的区别：在角色菜单基础上叠加该用户的**额外授予 / 额外撤销**，
   * 因此同一角色下的不同用户可能看到不同菜单。有效菜单集合口径见
   * `common/auth/effective-menu.ts`（与权限码解析同源）。
   *
   * 三重过滤：
   * ① 超管短路（不加关联限制 → 全部启用菜单）；
   * ② SQL 层 `menuType IN ('M','C')`——**按钮（F）在 SQL 层被裁掉**，不是内存剔除；
   * ③ 非超管按「有效菜单 id 集合」过滤（`id IN (...)`）。
   *
   * 缓存：无用户级覆盖时按「角色组合」共享（沿用既有键）；有覆盖时键追加用户维度
   * （`||u<id>`），避免同角色不同覆盖的用户串味。菜单 / 角色授权变更由
   * `authCache.invalidate()` 全清；用户级覆盖变更由 `authCache.invalidate(userId)` 精确清理。
   */
  async getMenusForUser(userId: number, roleCodes: string[]): Promise<MenuNode[]> {
    const isSuperAdmin = roleCodes.includes(SUPER_ADMIN_ROLE);

    // 非超管且无角色：直接返回空，不查库也不缓存
    if (!isSuperAdmin && roleCodes.length === 0) {
      return [];
    }

    // 非超管：解析角色 id（角色不存在 → 空，不缓存），并读取用户级覆盖
    let roleIds: number[] = [];
    let overrides: MenuOverride[] = [];
    if (!isSuperAdmin) {
      roleIds = (
        await this.prisma.role.findMany({
          where: { roleCode: { in: roleCodes } },
          select: { id: true },
        })
      ).map((role) => Number(role.id));
      if (roleIds.length === 0) {
        return [];
      }
      overrides = await loadUserMenuOverrides(this.prisma, userId);
    }

    // 缓存键：无覆盖时按角色组合共享；有覆盖时追加用户维度
    const baseKey = isSuperAdmin ? 'super' : [...roleCodes].sort().join(',');
    const cacheKey = overrides.length > 0 ? `${baseKey}||u${userId}` : baseKey;
    const cached = this.authCache.getMenuTree(cacheKey);
    if (cached) {
      return cached;
    }

    // 计算有效菜单 id 集合：角色菜单并集 ∪ GRANT − REVOKE（超管不限制）
    let idFilter: { id: { in: bigint[] } } = { id: { in: [] } };
    if (!isSuperAdmin) {
      const roleMenus = await this.prisma.roleMenu.findMany({
        where: { roleId: { in: roleIds.map((roleId) => BigInt(roleId)) } },
        select: { menuId: true },
      });
      const effective = mergeEffectiveMenuIds(
        roleMenus.map((row) => Number(row.menuId)),
        overrides,
      );
      idFilter = { id: { in: Array.from(effective).map((menuId) => BigInt(menuId)) } };
    }

    const rows = await this.prisma.menu.findMany({
      where: {
        status: Status.ENABLED,
        menuType: { in: [MenuType.DIRECTORY, MenuType.MENU] },
        // 超管不加此条件（看全部启用菜单）
        ...(isSuperAdmin ? {} : idFilter),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    const nodes = rows.map((row) => this.toMenuNode(row));
    // buildTree 会再按 sort → id 排一次每层子节点
    const tree = buildTree(nodes);
    this.authCache.setMenuTree(cacheKey, tree);
    return tree;
  }

  /** 列表查询菜单（支持按名称/状态过滤，tree=1 返回树）。 */
  async listMenus(query: Record<string, unknown>): Promise<MenuNode[]> {
    const menuName = readString(query.menuName);
    const status = readNumber(query.status);

    const rows = await this.prisma.menu.findMany({
      where: {
        ...(menuName ? { menuName: { contains: menuName } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const nodes = rows.map((row) => this.toMenuNode(row));
    const treeFlag = readString(query.tree);
    const isTree = treeFlag === '1' || treeFlag === 'true';
    return isTree ? buildTree(nodes) : nodes;
  }

  /** 全量菜单树（含禁用与按钮节点），供角色授权 / 上级选择。 */
  async getMenuTree(): Promise<MenuNode[]> {
    const rows = await this.prisma.menu.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    return buildTree(rows.map((row) => this.toMenuNode(row)));
  }

  /** 菜单详情。 */
  async getMenuDetail(id: number): Promise<MenuNode> {
    const row = await this.prisma.menu.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('菜单不存在');
    }
    return this.toMenuNode(row);
  }

  /**
   * 收集指定节点的全部后代 id（广度优先逐层下钻）。
   * 每层一次查询，层数 = 树深度。
   */
  private async collectDescendantIds(id: number): Promise<number[]> {
    const result: number[] = [];
    let currentLevel = [BigInt(id)];
    while (currentLevel.length > 0) {
      const children = await this.prisma.menu.findMany({
        where: { parentId: { in: currentLevel } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) {
        break;
      }
      result.push(...childIds.map(Number));
      currentLevel = childIds;
    }
    return result;
  }

  /** 校验父级菜单存在（非根时）。 */
  private async assertParentExists(parentId: number): Promise<void> {
    if (parentId === 0) {
      return;
    }
    const parent = await this.prisma.menu.findUnique({ where: { id: BigInt(parentId) }, select: { id: true } });
    if (!parent) {
      throw AppException.badRequest('上级菜单不存在');
    }
  }

  /** 入参 → 写入字段（统一处理默认值与空串）。 */
  private toWriteData(input: MenuUpsertDto): MenuWriteData {
    return {
      parentId: BigInt(input.parentId ?? 0),
      menuName: input.menuName,
      menuType: input.menuType,
      path: input.path ?? null,
      component: input.component ?? null,
      icon: input.icon ?? null,
      permission: input.permission ?? null,
      sort: input.sort ?? 0,
      visible: input.visible ?? 1,
      status: input.status ?? 1,
      redirect: input.redirect ?? null,
      keepAlive: input.keepAlive ?? 0,
    };
  }

  /** 创建菜单。 */
  async createMenu(input: MenuUpsertDto): Promise<MenuNode> {
    const parentId = input.parentId ?? 0;
    await this.assertParentExists(parentId);
    const row = await this.prisma.menu.create({ data: this.toWriteData(input) });
    this.authCache.invalidate();
    return this.toMenuNode(row);
  }

  /** 更新菜单（含防成环校验）。 */
  async updateMenu(id: number, input: MenuUpsertDto): Promise<MenuNode> {
    const existing = await this.prisma.menu.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('菜单不存在');
    }

    const parentId = input.parentId ?? 0;
    // 自环
    if (parentId === id) {
      throw AppException.badRequest('上级菜单不能为自身');
    }
    if (parentId !== 0) {
      await this.assertParentExists(parentId);
      // 防成环：父级不能是自己的后代
      const descendants = await this.collectDescendantIds(id);
      if (descendants.includes(parentId)) {
        throw AppException.badRequest('上级菜单不能为自身子级');
      }
    }

    const row = await this.prisma.menu.update({
      where: { id: BigInt(id) },
      data: this.toWriteData(input),
    });
    this.authCache.invalidate();
    return this.toMenuNode(row);
  }

  /** 删除菜单（需先删子菜单）。 */
  async deleteMenu(id: number): Promise<void> {
    const existing = await this.prisma.menu.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('菜单不存在');
    }
    const childCount = await this.prisma.menu.count({ where: { parentId: BigInt(id) } });
    if (childCount > 0) {
      throw AppException.conflict('存在子菜单，请先删除子菜单');
    }
    // 先清中间表（RoleMenu 有真实外键）
    await this.prisma.roleMenu.deleteMany({ where: { menuId: BigInt(id) } });
    await this.prisma.menu.delete({ where: { id: BigInt(id) } });
    this.authCache.invalidate();
  }
}
