/**
 * 企业单点登录（OIDC）接口。
 *
 * 登录面：providers 列表 / authorize 跳转地址 / redeem 换票。
 * 管理面：提供方 CRUD（clientSecret 只写不读：编辑时留空表示不修改）。
 */
import { del, get, post, put } from './request';
import type { SsoProvider, SsoProviderParams } from '@/types/api';

/** 登录页可见的启用中提供方 */
export function listSsoProvidersApi(): Promise<SsoProvider[]> {
  return get<SsoProvider[]>('/sso/providers');
}

/** 取授权跳转地址（前端拿到 URL 后 window.location 跳转） */
export function getSsoAuthorizeUrlApi(providerId: number): Promise<{ url: string }> {
  return get<{ url: string }>(`/sso/${providerId}/authorize`);
}

/** 一次性 ticket 换本站登录态 */
export function redeemSsoTicketApi(ticket: string): Promise<{ accessToken: string; refreshToken: string }> {
  return post<{ accessToken: string; refreshToken: string }>('/sso/redeem', { ticket });
}

/** 管理面：提供方列表（数量有限，一次返回） */
export function listSsoAdminProvidersApi(): Promise<{ list: SsoProvider[]; total: number }> {
  return get<{ list: SsoProvider[]; total: number }>('/sso/admin/providers');
}

/** 管理面：提供方详情 */
export function getSsoProviderApi(id: number): Promise<SsoProvider> {
  return get<SsoProvider>(`/sso/admin/providers/${id}`);
}

/** 管理面：新增提供方 */
export function createSsoProviderApi(data: SsoProviderParams): Promise<SsoProvider> {
  return post<SsoProvider>('/sso/admin/providers', data);
}

/** 管理面：更新提供方（clientSecret 留空 = 不修改） */
export function updateSsoProviderApi(id: number, data: SsoProviderParams): Promise<SsoProvider> {
  return put<SsoProvider>(`/sso/admin/providers/${id}`, data);
}

/** 管理面：删除提供方（绑定关系一并清理） */
export function deleteSsoProviderApi(id: number): Promise<null> {
  return del<null>(`/sso/admin/providers/${id}`);
}
