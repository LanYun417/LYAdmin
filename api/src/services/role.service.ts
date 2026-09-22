/**
 * 角色服务。
 * 模块职责：角色分页/下拉查询、CRUD、菜单授权（唯一操作 Role/RoleMenu 的层）。
 */
import { Op, type WhereOptions } from 'sequelize';
import { SUPER_ADMIN_ROLE } from '@/constants';
import { Role, RoleMenu, UserRole } from '@/models';
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
}

/** 将 Role 实例转换为简要信息。 */
function toRoleBrief(role: Role): RoleBrief {
  return {
    id: Number(role.id),
    roleName: role.roleName,
    roleCode: role.roleCode,
    status: Number(role.status),
    sort: Number(role.sort),
  };
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

  return buildPageResult(rows.map(toRoleBrief), count, page, pageSize);
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
  return roles.map(toRoleBrief);
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
    remark: input.remark || null,
  });
  return toRoleBrief(role);
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
    remark: input.remark || null,
  });
  return toRoleBrief(role);
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
  await role.destroy();
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
}
