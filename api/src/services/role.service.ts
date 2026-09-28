/**
 * 角色服务。
 * 模块职责：角色分页/下拉查询、CRUD、菜单授权（唯一操作 Role/RoleMenu 的层）。
 */
import { Op, type WhereOptions } from 'sequelize';
import { DataScope, SUPER_ADMIN_ROLE } from '@/constants';
import { Role, RoleDept, RoleMenu, UserRole } from '@/models';
import { invalidateAuthCache } from '@/services/authCache';
import type { PageResult } from '@/types';
import { buildPageResult, parsePagination } from '@/utils/pagination';
import { AppError } from '@/utils/response';
import type { CreateRoleInput, UpdateRoleInput } from '@/validators/role.validator';

/** 角色简要信息。 */
export interface RoleBrief {
  id: number;
  roleName: string;
  roleCode: string;
  status: number;
  sort: number;
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope: number;
  /** 自定义部门 id 列表（仅 dataScope=2 时非空） */
  deptIds: number[];
}

/** 将 Role 实例转换为简要信息。 */
function toRoleBrief(role: Role, deptIds: number[] = []): RoleBrief {
  return {
    id: Number(role.id),
    roleName: role.roleName,
    roleCode: role.roleCode,
    status: Number(role.status),
    sort: Number(role.sort),
    dataScope: Number(role.dataScope ?? DataScope.ALL),
    deptIds,
  };
}

/** 批量加载角色的自定义部门 id（按 roleId 分组）。 */
async function loadDeptIdsByRoleIds(roleIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (roleIds.length === 0) {
    return map;
  }
  const rows = await RoleDept.findAll({
    where: { roleId: { [Op.in]: roleIds } },
    attributes: ['roleId', 'deptId'],
  });
  rows.forEach((row) => {
    const roleId = Number(row.roleId);
    const list = map.get(roleId) ?? [];
    list.push(Number(row.deptId));
    map.set(roleId, list);
  });
  return map;
}

/** 同步角色的自定义部门（仅 dataScope=2 时保留，其余情况清空）。 */
async function syncRoleDepts(roleId: number, dataScope: number, deptIds: number[]): Promise<void> {
  await RoleDept.destroy({ where: { roleId } });
  if (dataScope !== DataScope.CUSTOM) {
    return;
  }
  const unique = Array.from(new Set(deptIds));
  if (unique.length > 0) {
    await RoleDept.bulkCreate(
      unique.map((deptId) => ({ roleId, deptId })),
      { ignoreDuplicates: true },
    );
  }
}

/**
 * 分页查询角色。
 * @param query 查询参数（page/pageSize/roleName/status）
 */
export async function listRoles(query: Record<string, unknown>): Promise<PageResult<RoleBrief>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const roleName = typeof query.roleName === 'string' ? query.roleName.trim() : '';
  if (roleName) {
    where.roleName = { [Op.like]: `%${roleName}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const { rows, count } = await Role.findAndCountAll({
    where,
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
    offset,
    limit,
  });

  const deptIdsMap = await loadDeptIdsByRoleIds(rows.map((role) => Number(role.id)));
  return buildPageResult(
    rows.map((role) => toRoleBrief(role, deptIdsMap.get(Number(role.id)) ?? [])),
    count,
    page,
    pageSize,
  );
}

/**
 * 查询全部启用角色（下拉用）。
 */
export async function listAllRoles(): Promise<RoleBrief[]> {
  const roles = await Role.findAll({
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const deptIdsMap = await loadDeptIdsByRoleIds(roles.map((role) => Number(role.id)));
  return roles.map((role) => toRoleBrief(role, deptIdsMap.get(Number(role.id)) ?? []));
}

/**
 * 新增角色。
 * @param input 新增参数
 */
export async function createRole(input: CreateRoleInput): Promise<RoleBrief> {
  const exists = await Role.findOne({ where: { roleCode: input.roleCode } });
  if (exists) {
    throw AppError.conflict('角色编码已存在');
  }
  const role = await Role.create({
    roleName: input.roleName,
    roleCode: input.roleCode,
    sort: input.sort,
    status: input.status,
    dataScope: input.dataScope,
    remark: input.remark || null,
  });
  await syncRoleDepts(Number(role.id), input.dataScope, input.deptIds);
  return toRoleBrief(role, input.dataScope === DataScope.CUSTOM ? Array.from(new Set(input.deptIds)) : []);
}

/**
 * 编辑角色。
 * @param id 角色 id
 * @param input 编辑参数
 */
export async function updateRole(id: number, input: UpdateRoleInput): Promise<RoleBrief> {
  const role = await Role.findByPk(id);
  if (!role) {
    throw AppError.notFound('角色不存在');
  }
  await role.update({
    roleName: input.roleName,
    sort: input.sort,
    status: input.status,
    dataScope: input.dataScope,
    remark: input.remark || null,
  });
  await syncRoleDepts(id, input.dataScope, input.deptIds);
  // 角色信息变更：清空鉴权缓存（角色可能被多个用户持有，影响面广）
  invalidateAuthCache();
  return toRoleBrief(role, input.dataScope === DataScope.CUSTOM ? Array.from(new Set(input.deptIds)) : []);
}

/**
 * 删除角色（内置超管角色不可删，存在关联用户时不可删）。
 * @param id 角色 id
 */
export async function deleteRole(id: number): Promise<void> {
  const role = await Role.findByPk(id);
  if (!role) {
    throw AppError.notFound('角色不存在');
  }
  if (role.roleCode === SUPER_ADMIN_ROLE) {
    throw AppError.conflict('内置超级管理员角色不可删除');
  }
  const userCount = await UserRole.count({ where: { roleId: id } });
  if (userCount > 0) {
    throw AppError.conflict('该角色下存在用户，无法删除');
  }
  await RoleMenu.destroy({ where: { roleId: id } });
  await RoleDept.destroy({ where: { roleId: id } });
  await role.destroy();
  // 角色删除：清空鉴权缓存（防御性，确保不再残留该角色相关权限）
  invalidateAuthCache();
}

/**
 * 查询角色已授权菜单 id 列表。
 * @param id 角色 id
 */
export async function getRoleMenuIds(id: number): Promise<number[]> {
  const role = await Role.findByPk(id);
  if (!role) {
    throw AppError.notFound('角色不存在');
  }
  const records = await RoleMenu.findAll({ where: { roleId: id }, attributes: ['menuId'] });
  return records.map((record) => Number(record.menuId));
}

/**
 * 授权角色菜单（先清后建）。
 * @param id 角色 id
 * @param menuIds 菜单 id 列表
 */
export async function assignMenus(id: number, menuIds: number[]): Promise<void> {
  const role = await Role.findByPk(id);
  if (!role) {
    throw AppError.notFound('角色不存在');
  }
  await RoleMenu.destroy({ where: { roleId: id } });
  const unique = Array.from(new Set(menuIds));
  if (unique.length > 0) {
    await RoleMenu.bulkCreate(
      unique.map((menuId) => ({ roleId: id, menuId })),
      { ignoreDuplicates: true },
    );
  }
  // 角色菜单授权变更 → 权限码集合变化：清空鉴权缓存（影响所有持有该角色的用户）
  invalidateAuthCache();
}
