/**
 * 权限判定工具（按钮权限码 / 角色），供 `v-permission` 指令与页面逻辑共用。
 * 统一 fail-closed（空参数视为无权限），与后端 `requirePermission` 语义保持一致。
 */
import { useUserStore } from '@/store/modules/user';

/**
 * 判定当前用户是否具备指定按钮权限码。
 *
 * 采用 fail-closed 策略：空码 / 空数组一律返回 false（与后端 `requirePermission` 一致），
 * 避免权限码拼错或误传空值时静默放行按钮。
 *
 * @param code 单个权限码，或权限码数组（任一命中即为 true）
 * @returns 命中返回 true；未命中或参数为空返回 false
 */
export function hasPermission(code: string | string[] | undefined | null): boolean {
  if (!code || (Array.isArray(code) && code.length === 0)) {
    return false;
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
 * 同样采用 fail-closed：空值 / 空数组返回 false。
 *
 * @param roles 角色编码或角色编码数组
 */
export function hasRole(roles: string | string[] | undefined | null): boolean {
  if (!roles || (Array.isArray(roles) && roles.length === 0)) {
    return false;
  }
  const userStore = useUserStore();
  const owned = userStore.roles ?? [];
  const targets = Array.isArray(roles) ? roles : [roles];
  return targets.some((item) => owned.includes(item));
}
