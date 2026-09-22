import type { Directive, DirectiveBinding } from 'vue';
import { hasPermission } from '@/utils/permission';

/**
 * 按钮级权限指令：`v-permission="'system:user:add'"` 或 `v-permission="['a','b']"`。
 * 无权限时移除元素。
 */
const permission: Directive<HTMLElement, string | string[]> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>): void {
    const { value } = binding;
    if (!value) {
      return;
    }
    if (!hasPermission(value)) {
      el.parentNode?.removeChild(el);
    }
  },
};

export default permission;
