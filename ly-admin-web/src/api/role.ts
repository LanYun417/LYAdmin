/**
 * 角色接口：角色分页列表、下拉选项、增删改与菜单授权。
 */
import { del, get, post, put, request } from './request';
import type {
  BatchDeleteSummary,
  PageResult,
  ResetRoleMenusResult,
  Role,
  RoleBrief,
  RoleQuery,
  RoleUpsert,
} from '@/types/api';

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

/** 批量删除角色（内置超管角色 / 仍有用户持有的角色会被跳过并回传原因） */
export function batchDeleteRolesApi(ids: number[]): Promise<BatchDeleteSummary> {
  return request<BatchDeleteSummary>({ url: '/roles', method: 'DELETE', data: { ids } });
}

/** 角色已授权菜单 id 列表 */
export function getRoleMenuIdsApi(id: number): Promise<number[]> {
  return get<number[]>(`/roles/${id}/menus`);
}

/** 授权角色菜单 */
export function assignRoleMenusApi(id: number, menuIds: number[]): Promise<null> {
  return put<null>(`/roles/${id}/menus`, { menuIds });
}

/**
 * 按种子定义恢复角色的默认菜单授权。
 * 不传 roleIds = 恢复全部种子角色。
 */
export function resetRoleMenusApi(roleIds?: number[]): Promise<ResetRoleMenusResult> {
  return post<ResetRoleMenusResult>('/roles/reset-menus', { roleIds: roleIds ?? [] });
}
