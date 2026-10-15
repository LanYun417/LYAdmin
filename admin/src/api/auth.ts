/**
 * 认证接口：登录 / 刷新 Token / 登出 / 当前用户信息、菜单树与权限码。
 */
import { get, post } from './request';
import type { CaptchaResult, LoginParams, LoginResult, MenuNode, ProfileResult, RefreshResult } from '@/types/api';

/**
 * 获取登录图形验证码。
 *
 * 以 `silent` 静默请求：登录页已自带「加载中 / 加载失败可重新加载」状态，
 * 且失败后会自动重试。若不静默，后端未就绪时会连续弹出多条「网络异常」，
 * 顶部进度条也会随每次重试反复闪动。失败由调用方（登录页）负责呈现。
 */
export function getCaptchaApi(): Promise<CaptchaResult> {
  return get<CaptchaResult>('/auth/captcha', undefined, { silent: true });
}

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
