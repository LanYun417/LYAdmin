/**
 * 认证接口：登录 / 刷新 Token / 登出 / 当前用户信息、菜单树与权限码。
 */
import { get, post } from './request';
import type { LoginParams, LoginResult, MenuNode, ProfileResult, RefreshResult } from '@/types/api';

/** 登录 */
export function loginApi(data: LoginParams): Promise<LoginResult> {
  return post<LoginResult>('/auth/login', data);
}

/** 刷新 Token */
export function refreshApi(refreshToken: string): Promise<RefreshResult> {
  return post<RefreshResult>('/auth/refresh', { refreshToken });
}

/** 登出 */
export function logoutApi(): Promise<null> {
  return post<null>('/auth/logout');
}

/** 当前用户信息（含角色、权限码） */
export function getProfileApi(): Promise<ProfileResult> {
  return get<ProfileResult>('/auth/profile');
}

/** 当前用户菜单树 */
export function getMenusApi(): Promise<MenuNode[]> {
  return get<MenuNode[]>('/auth/menus');
}

/** 当前用户按钮权限码列表 */
export function getPermissionsApi(): Promise<string[]> {
  return get<string[]>('/auth/permissions');
}
