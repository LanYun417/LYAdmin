import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import type { MenuNode } from '@/types/api';
import { usePermissionStore } from '@/store/modules/permission';

// 隔离路由模块：其真实实现会引入 Layout 等 .vue 组件，本测试只关心路由树的生成逻辑。
vi.mock('@/router/routes', () => ({
  AFFIX_TAB_PATHS: ['/home'],
}));

const menus = [
  {
    id: 1,
    menuName: '系统管理',
    menuType: 'M',
    path: '/system',
    status: 1,
    children: [
      {
        id: 11,
        menuName: '用户管理',
        menuType: 'C',
        path: 'user',
        component: 'system/user/index',
        status: 1,
        children: [
          { id: 111, menuName: '新增用户', menuType: 'F', permission: 'system:user:add', status: 1, children: [] },
          { id: 112, menuName: '编辑用户', menuType: 'F', permission: 'system:user:add', status: 1, children: [] },
        ],
      },
      {
        id: 12,
        menuName: '角色管理',
        menuType: 'C',
        path: 'role',
        component: 'system/role/index',
        status: 1,
        children: [],
      },
      {
        id: 13,
        menuName: '已禁用',
        menuType: 'C',
        path: 'disabled',
        component: 'system/disabled/index',
        status: 0,
        children: [],
      },
    ],
  },
  {
    id: 2,
    menuName: '首页',
    menuType: 'C',
    path: '/home',
    component: 'home/index',
    status: 1,
    children: [],
  },
] as unknown as MenuNode[];

describe('permission store - generateRoutes', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('builds a nested route tree and skips disabled / button nodes', () => {
    const store = usePermissionStore();
    const routes = store.generateRoutes(menus);

    // 顶层两个一级菜单
    expect(routes).toHaveLength(2);

    const system = routes.find((r) => r.path === 'system')!;
    expect(system).toBeDefined();
    expect(system.name).toBe('System');
    // 已禁用菜单（status 0）被跳过 → 只剩 user / role 两个子路由
    expect((system.children ?? []).map((c) => c.path)).toEqual(['user', 'role']);

    const user = (system.children ?? []).find((c) => c.path === 'user')!;
    expect(user.name).toBe('SystemUser');
    expect(user.meta?.title).toBe('用户管理');
    // 叶子路由（F 节点不生成路由）
    expect(user.children ?? []).toHaveLength(0);
  });

  it('does not duplicate path segments for absolute child paths', () => {
    const store = usePermissionStore();
    const routes = store.generateRoutes(menus);
    // '/home' 作为绝对路径被规范化，注册时不应变成 'home/home'
    const home = routes.find((r) => r.path === 'home')!;
    expect(home).toBeDefined();
    expect(home.name).toBe('HomePage'); // 命中 ROUTE_NAME_OVERRIDES
  });

  it('collects and dedups button permission codes', () => {
    const store = usePermissionStore();
    store.generateRoutes(menus);
    expect(store.buttonPermissions).toEqual(['system:user:add']);
  });

  it('resetRoutes clears state', () => {
    const store = usePermissionStore();
    store.generateRoutes(menus);
    expect(store.routes.length).toBeGreaterThan(0);
    store.resetRoutes();
    expect(store.routes).toHaveLength(0);
    expect(store.buttonPermissions).toHaveLength(0);
    expect(store.added).toBe(false);
  });
});
