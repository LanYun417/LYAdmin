import { useUserStore } from '@/store/modules/user';

/**
 * 判定当前用户是否具备指定按钮权限码。
 *
 * @param code 单个权限码，或权限码数组（任一命中即为 true）
 * @returns 命中返回 true；未命中返回 false
 */
export function hasPermission(code: string | string[] | undefined | null): boolean {
  if (!code || (Array.isArray(code) && code.length === 0)) {
    return true;
  }
  const userStore = useUserStore();
  const permissions = userStore.permissions ?? [];
  // 超管通配：后端对超级管理员下发 `["*"]`，兼容 `*:*:*` 形式
  if (permissions.includes('*') || permissions.includes('*:*:*')) {
    return true;
  }
  const codes = Array.isArray(code) ? code : [code];
  return codes.some((item) => permissions.includes(item));
}

/**
 * 判定当前用户是否命中任一角色。
 *
 * @param roles 角色编码或角色编码数组
 */
export function hasRole(roles: string | string[] | undefined | null): boolean {
  if (!roles || (Array.isArray(roles) && roles.length === 0)) {
    return true;
  }
  const userStore = useUserStore();
  const owned = userStore.roles ?? [];
  const targets = Array.isArray(roles) ? roles : [roles];
  return targets.some((item) => owned.includes(item));
}
