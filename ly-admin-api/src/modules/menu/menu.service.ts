/**
 * 菜单服务。
 * 模块职责：菜单树查询、按角色过滤下发的菜单（供动态路由）、菜单 CRUD、防成环校验。
 * 迁移自原 Express 版本的 services/menu.service.ts。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app.exception.js';
import { AuthCacheService } from '../../common/auth-cache.service.js';
import { MenuType, Status, SUPER_ADMIN_ROLE } from '../../common/constants.js';
import { buildTree, readString } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MenuNode } from '../../common/types.js';

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
   * 按角色查询菜单树（供 /auth/menus 下发，供前端生成动态路由）。
   *
   * 三重过滤（与原实现 1:1）：
   * ① 超管短路（不加角色关联限制 → 全部启用菜单）；
   * ② SQL 层 `menuType IN ('M','C')`——**按钮（F）在 SQL 层被裁掉**，不是内存剔除；
   * ③ 非超管按 roleIds 过滤（INNER JOIN 语义 → Prisma include + some）。
   */
  async getMenusByRoles(roleCodes: string[], roleIds: number[]): Promise<MenuNode[]> {
    const isSuperAdmin = roleCodes.includes(SUPER_ADMIN_ROLE);

    // 非超管且无角色：直接返回空，不查库
    if (!isSuperAdmin && roleIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.menu.findMany({
      where: {
        status: Status.ENABLED,
        menuType: { in: [MenuType.DIRECTORY, MenuType.MENU] },
        // 超管不加此条件（看全部启用菜单）
        // 角色过滤走显式中间表 sys_role_menu（Menu 上不存在 roles 关系，
        // 写成 roles: { some } 类型检查不报错、运行期会抛 Unknown argument）
        ...(isSuperAdmin ? {} : { roleMenus: { some: { roleId: { in: roleIds.map((roleId) => BigInt(roleId)) } } } }),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    const nodes = rows.map((row) => this.toMenuNode(row));
    // buildTree 会再按 sort → id 排一次每层子节点
    const tree = buildTree(nodes);
    return tree;
  }

  /** 列表查询菜单（支持按名称/状态过滤，tree=1 返回树）。 */
  async listMenus(query: Record<string, unknown>): Promise<MenuNode[] | MenuNode[]> {
    const menuName = readString(query.menuName);
    const status = readStatus(query.status);

    const rows = await this.prisma.menu.findMany({
      where: {
        ...(menuName ? { menuName: { contains: menuName } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const nodes = rows.map((row) => this.toMenuNode(row));
    const isTree = String(query.tree ?? '') === '1' || String(query.tree ?? '') === 'true';
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
   * 与原实现一致：每层一次查询，层数 = 树深度。
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

  /** 菜单创建入参。 */
  private toCreateData(input: Record<string, unknown>): Record<string, unknown> {
    return {
      parentId: BigInt(Number(input.parentId ?? 0)),
      menuName: String(input.menuName),
      menuType: String(input.menuType),
      path: (input.path as string) || null,
      component: (input.component as string) || null,
      icon: (input.icon as string) || null,
      permission: (input.permission as string) || null,
      sort: Number(input.sort ?? 0),
      visible: Number(input.visible ?? 1),
      status: Number(input.status ?? 1),
      redirect: (input.redirect as string) || null,
      keepAlive: Number(input.keepAlive ?? 0),
    };
  }

  /** 创建菜单。 */
  async createMenu(input: Record<string, unknown>): Promise<MenuNode> {
    const parentId = Number(input.parentId ?? 0);
    await this.assertParentExists(parentId);
    const row = await this.prisma.menu.create({ data: this.toCreateData(input) as never });
    this.authCache.invalidate();
    return this.toMenuNode(row);
  }

  /** 更新菜单（含防成环校验）。 */
  async updateMenu(id: number, input: Record<string, unknown>): Promise<MenuNode> {
    const existing = await this.prisma.menu.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('菜单不存在');
    }

    const parentId = Number(input.parentId ?? 0);
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
      data: {
        parentId: BigInt(parentId),
        menuName: String(input.menuName),
        menuType: String(input.menuType),
        path: (input.path as string) || null,
        component: (input.component as string) || null,
        icon: (input.icon as string) || null,
        permission: (input.permission as string) || null,
        sort: Number(input.sort ?? 0),
        visible: Number(input.visible ?? 1),
        status: Number(input.status ?? 1),
        redirect: (input.redirect as string) || null,
        keepAlive: Number(input.keepAlive ?? 0),
      },
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

/** 解析 status 查询参数。 */
function readStatus(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
