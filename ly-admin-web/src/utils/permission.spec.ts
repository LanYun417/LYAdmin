import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// 隔离命令式组件库：@/utils/element 以副作用方式引入 element-plus 样式，
// 权限判定用例不需要真实 UI，stub 掉即可避免加载 .css 报错。
vi.mock('@/utils/element', () => ({
  ElMessage: () => {},
  ElMessageBox: { confirm: () => Promise.resolve({}) },
}));

import { useUserStore } from '@/store/modules/user';
import { hasPermission, hasRole } from '@/utils/permission';

describe('permission utils', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('hasPermission (fail-closed)', () => {
    it('returns false for empty arguments', () => {
      expect(hasPermission(undefined)).toBe(false);
      expect(hasPermission(null)).toBe(false);
      expect(hasPermission('')).toBe(false);
      expect(hasPermission([])).toBe(false);
    });

    it('matches a single permission code', () => {
      useUserStore().setPermissions(['system:user:list']);
      expect(hasPermission('system:user:list')).toBe(true);
      expect(hasPermission('system:user:edit')).toBe(false);
    });

    it('matches any code in an array', () => {
      useUserStore().setPermissions(['a', 'b']);
      expect(hasPermission(['x', 'b'])).toBe(true);
      expect(hasPermission(['y', 'z'])).toBe(false);
    });

    it('grants everything for super-admin wildcards', () => {
      useUserStore().setPermissions(['*']);
      expect(hasPermission('system:anything:here')).toBe(true);
      useUserStore().setPermissions(['*:*:*']);
      expect(hasPermission('system:anything:here')).toBe(true);
    });

    it('falls back to store default (empty) when nothing set', () => {
      expect(hasPermission('x')).toBe(false);
    });
  });

  describe('hasRole (fail-closed)', () => {
    it('returns false for empty arguments', () => {
      expect(hasRole(undefined)).toBe(false);
      expect(hasRole([])).toBe(false);
    });

    it('matches owned roles (single or array)', () => {
      useUserStore().setRoles(['admin']);
      expect(hasRole('admin')).toBe(true);
      expect(hasRole(['admin', 'editor'])).toBe(true);
      expect(hasRole(['editor'])).toBe(false);
    });
  });
});
