/**
 * 用户接口：用户分页列表、详情、增删改、状态切换、重置密码与分配角色。
 */
import { del, get, post, put, request } from './request';
import type {
  BatchDeleteSummary,
  PageResult,
  UserDetail,
  UserImportResult,
  UserMenuOverview,
  UserQuery,
  UserUpsert,
} from '@/types/api';

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

/**
 * 批量删除用户。
 * 返回「成功条数 + 被跳过明细」：超管保护、当前登录账号等条目不会被删，原因由后端回传。
 */
export function batchDeleteUsersApi(ids: number[]): Promise<BatchDeleteSummary> {
  return request<BatchDeleteSummary>({ url: '/users', method: 'DELETE', data: { ids } });
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

/** 用户的菜单权限概况（角色自带 / 额外授予 / 额外撤销 / 最终有效） */
export function getUserMenusApi(id: number): Promise<UserMenuOverview> {
  return get<UserMenuOverview>(`/users/${id}/menus`);
}

/**
 * 保存用户的额外菜单权限。
 * 入参为「期望的最终有效菜单集合」——服务端与角色自带集合求差，得出额外授予 / 额外撤销。
 */
export function assignUserMenusApi(id: number, menuIds: number[]): Promise<null> {
  return put<null>(`/users/${id}/menus`, { menuIds });
}

/**
 * 下载 CSV 导入模板（二进制流，前端用 downloadBlob 落盘）。
 */
export function getUserImportTemplateApi(): Promise<Blob> {
  return request<Blob>({
    url: '/users/import/template',
    method: 'GET',
    responseType: 'blob',
  });
}

/**
 * CSV 批量导入用户。
 * 返回的是**导入报告**而非异常：行级问题在 `failed` 里逐行说明，
 * 任一行不合格时服务端不写入任何数据（created=0）。
 */
export function importUsersApi(file: File): Promise<UserImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return request<UserImportResult>({
    url: '/users/import',
    method: 'POST',
    data: formData,
  });
}
