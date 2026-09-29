/**
 * 用户接口：用户分页列表、详情、增删改、状态切换、重置密码与分配角色。
 */
import { del, get, post, put } from './request';
import type { PageResult, UserDetail, UserQuery, UserUpsert } from '@/types/api';

/** 用户分页列表 */
export function getUserListApi(params: UserQuery): Promise<PageResult<UserDetail>> {
  return get<PageResult<UserDetail>>('/users', params);
}

/** 用户详情 */
export function getUserDetailApi(id: number): Promise<UserDetail> {
  return get<UserDetail>(`/users/${id}`);
}

/** 新增用户 */
export function createUserApi(data: UserUpsert): Promise<UserDetail> {
  return post<UserDetail>('/users', data);
}

/** 编辑用户 */
export function updateUserApi(id: number, data: Partial<UserUpsert>): Promise<UserDetail> {
  return put<UserDetail>(`/users/${id}`, data);
}

/** 删除用户 */
export function deleteUserApi(id: number): Promise<null> {
  return del<null>(`/users/${id}`);
}

/** 启用 / 禁用用户 */
export function updateUserStatusApi(id: number, status: number): Promise<null> {
  return put<null>(`/users/${id}/status`, { status });
}

/** 重置密码 */
export function resetUserPasswordApi(id: number, password: string): Promise<null> {
  return put<null>(`/users/${id}/password`, { password });
}

/** 分配角色 */
export function assignUserRolesApi(id: number, roleIds: number[]): Promise<null> {
  return put<null>(`/users/${id}/roles`, { roleIds });
}
