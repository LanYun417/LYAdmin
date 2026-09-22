import { del, get, post, put } from './request';
import type { PageResult, Role, RoleBrief, RoleQuery, RoleUpsert } from '@/types/api';

/** 角色分页列表 */
export function getRoleListApi(params: RoleQuery): Promise<PageResult<Role>> {
  return get<PageResult<Role>>('/roles', params);
}

/** 全部角色（下拉用） */
export function getAllRolesApi(): Promise<RoleBrief[]> {
  return get<RoleBrief[]>('/roles/all');
}

/** 新增角色 */
export function createRoleApi(data: RoleUpsert): Promise<Role> {
  return post<Role>('/roles', data);
}

/** 编辑角色 */
export function updateRoleApi(id: number, data: Partial<RoleUpsert>): Promise<Role> {
  return put<Role>(`/roles/${id}`, data);
}

/** 删除角色 */
export function deleteRoleApi(id: number): Promise<null> {
  return del<null>(`/roles/${id}`);
}

/** 角色已授权菜单 id 列表 */
export function getRoleMenuIdsApi(id: number): Promise<number[]> {
  return get<number[]>(`/roles/${id}/menus`);
}

/** 授权角色菜单 */
export function assignRoleMenusApi(id: number, menuIds: number[]): Promise<null> {
  return put<null>(`/roles/${id}/menus`, { menuIds });
}
