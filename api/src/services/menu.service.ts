/**
 * 菜单服务。
 * 模块职责：菜单 CRUD、树构建、按角色下发菜单树（唯一操作 Menu/RoleMenu 的层）。
 */
import { Op, type FindOptions, type WhereOptions } from 'sequelize';
import { MenuType, Status, SUPER_ADMIN_ROLE } from '@/constants';
import { Menu, Role, RoleMenu } from '@/models';
import { invalidateAuthCache } from '@/services/authCache';
import type { MenuNode } from '@/types';
import { buildTree } from '@/utils/tree';
import { AppError } from '@/utils/response';
import type { MenuUpsertInput } from '@/validators/menu.validator';

/**
 * 将 Menu 实例转换为菜单节点。
 * @param menu 菜单实例
 */
export function toMenuNode(menu: Menu): MenuNode {
  return {
    id: Number(menu.id),
    parentId: Number(menu.parentId),
    menuName: menu.menuName,
    menuType: menu.menuType,
    path: menu.path,
    component: menu.component,
    icon: menu.icon,
    permission: menu.permission,
    sort: Number(menu.sort),
    visible: Number(menu.visible),
    status: Number(menu.status),
    redirect: menu.redirect,
    keepAlive: Number(menu.keepAlive),
  };
}

/**
 * 按角色下发菜单树（仅目录/菜单节点，超管返回全部）。
 * @param roleCodes 角色编码列表
 * @param roleIds 角色 id 列表
 */
export async function getMenusByRoles(roleCodes: string[], roleIds: number[]): Promise<MenuNode[]> {
  const isSuperAdmin = roleCodes.includes(SUPER_ADMIN_ROLE);

  const where: WhereOptions = {
    status: Status.ENABLED,
    menuType: { [Op.in]: [MenuType.DIRECTORY, MenuType.MENU] },
  };

  const options: FindOptions = {
    where,
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  };

  if (!isSuperAdmin) {
    if (roleIds.length === 0) {
      return [];
    }
    options.include = [
      {
        model: Role,
        attributes: [],
        through: { attributes: [] },
        where: { id: { [Op.in]: roleIds } },
        required: true,
      },
    ];
  }

  const menus = await Menu.findAll(options);
  return buildTree(menus.map(toMenuNode));
}

/**
 * 查询菜单列表（可选返回树）。
 * @param query 查询参数（menuName/status/tree）
 */
export async function listMenus(query: Record<string, unknown>): Promise<MenuNode[]> {
  const where: WhereOptions = {};

  const menuName = typeof query.menuName === 'string' ? query.menuName.trim() : '';
  if (menuName) {
    where.menuName = { [Op.like]: `%${menuName}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const menus = await Menu.findAll({
    where,
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const nodes = menus.map(toMenuNode);

  const treeFlag = String(query.tree ?? '');
  const wantTree = treeFlag === '1' || treeFlag === 'true';
  return wantTree ? buildTree(nodes) : nodes;
}

/**
 * 查询完整菜单树（含按钮，供角色授权/上级选择）。
 */
export async function getMenuTree(): Promise<MenuNode[]> {
  const menus = await Menu.findAll({
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return buildTree(menus.map(toMenuNode));
}

/**
 * 查询菜单详情。
 * @param id 菜单 id
 */
export async function getMenuDetail(id: number): Promise<MenuNode> {
  const menu = await Menu.findByPk(id);
  if (!menu) {
    throw AppError.notFound('菜单不存在');
  }
  return toMenuNode(menu);
}

/**
 * 新增菜单。
 * @param input 新增参数
 */
export async function createMenu(input: MenuUpsertInput): Promise<MenuNode> {
  if (input.parentId !== 0) {
    const parent = await Menu.findByPk(input.parentId);
    if (!parent) {
      throw AppError.badRequest('上级菜单不存在');
    }
  }

  const menu = await Menu.create({
    parentId: input.parentId,
    menuName: input.menuName,
    menuType: input.menuType,
    path: input.path || null,
    component: input.component || null,
    icon: input.icon || null,
    permission: input.permission || null,
    sort: input.sort,
    visible: input.visible,
    status: input.status,
    redirect: input.redirect || null,
    keepAlive: input.keepAlive,
  });

  // 菜单变更影响权限码集合：清空鉴权缓存（影响面广，全清）
  invalidateAuthCache();
  return toMenuNode(menu);
}

/**
 * 编辑菜单。
 * @param id 菜单 id
 * @param input 编辑参数
 */
export async function updateMenu(id: number, input: MenuUpsertInput): Promise<MenuNode> {
  const menu = await Menu.findByPk(id);
  if (!menu) {
    throw AppError.notFound('菜单不存在');
  }
  if (input.parentId === id) {
    throw AppError.badRequest('上级菜单不能为自身');
  }
  if (input.parentId !== 0) {
    const parent = await Menu.findByPk(input.parentId);
    if (!parent) {
      throw AppError.badRequest('上级菜单不存在');
    }
    // 防止将父级设置为自身后代，形成环
    const descendants = await collectDescendantIds(id);
    if (descendants.includes(input.parentId)) {
      throw AppError.badRequest('上级菜单不能为自身子级');
    }
  }

  await menu.update({
    parentId: input.parentId,
    menuName: input.menuName,
    menuType: input.menuType,
    path: input.path || null,
    component: input.component || null,
    icon: input.icon || null,
    permission: input.permission || null,
    sort: input.sort,
    visible: input.visible,
    status: input.status,
    redirect: input.redirect || null,
    keepAlive: input.keepAlive,
  });

  // 菜单变更影响权限码集合：清空鉴权缓存（影响面广，全清）
  invalidateAuthCache();
  return toMenuNode(menu);
}

/**
 * 收集指定菜单的全部后代 id。
 * @param id 菜单 id
 */
async function collectDescendantIds(id: number): Promise<number[]> {
  const result: number[] = [];
  let currentLevel: number[] = [id];

  while (currentLevel.length > 0) {
    const children = await Menu.findAll({
      where: { parentId: { [Op.in]: currentLevel } },
      attributes: ['id'],
    });
    const childIds = children.map((child) => Number(child.id));
    if (childIds.length === 0) {
      break;
    }
    result.push(...childIds);
    currentLevel = childIds;
  }

  return result;
}

/**
 * 删除菜单（存在子级时拒绝）。
 * @param id 菜单 id
 */
export async function deleteMenu(id: number): Promise<void> {
  const menu = await Menu.findByPk(id);
  if (!menu) {
    throw AppError.notFound('菜单不存在');
  }
  const childCount = await Menu.count({ where: { parentId: id } });
  if (childCount > 0) {
    throw AppError.conflict('存在子菜单，请先删除子菜单');
  }
  await RoleMenu.destroy({ where: { menuId: id } });
  await menu.destroy();
  // 菜单删除影响权限码集合：清空鉴权缓存（影响面广，全清）
  invalidateAuthCache();
}
