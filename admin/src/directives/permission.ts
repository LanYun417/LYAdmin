import type { Directive, DirectiveBinding } from 'vue';
import { hasPermission } from '@/utils/permission';

/**
 * 按钮级权限指令：`v-permission="'system:user:add'"` 或 `v-permission="['a','b']"`。
 * 无权限时移除元素。
 * fail-closed：空值 / 空数组视为无权限（`hasPermission` 对空参返回 false），同样移除元素，
 * 避免权限码缺失或拼错时按钮被放行。
 */
const permission: Directive<HTMLElement, string | string[]> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>): void {
    const { value } = binding;
    if (!hasPermission(value)) {
      el.parentNode?.removeChild(el);
    }
  },
};

export default permission;
