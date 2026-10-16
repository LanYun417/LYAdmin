/**
 * Token 读写工具（localStorage）。
 * 作为登录态的唯一权威来源，供 axios 拦截器与 Store 共享。
 */

const ACCESS_TOKEN_KEY = 'ly_admin_access_token';
const REFRESH_TOKEN_KEY = 'ly_admin_refresh_token';

/** 读取 accessToken */
export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

/** 写入 accessToken */
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/** 读取 refreshToken */
export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
}

/** 写入 refreshToken */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/** 同时写入双 Token */
export function setToken(accessToken: string, refreshToken: string): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

/** 清空双 Token */
export function removeToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
