import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { defineStore } from 'pinia';
import type { MenuNode } from '@/types/api';
import type { AppRouteMeta } from '@/types/router';

/** 嵌套目录的透传组件（渲染子路由出口） */
const RouterViewPassthrough = defineComponent({
  name: 'RouterViewPassthrough',
  render: () => h(RouterView),
});

/** 预取全部页面组件（懒加载映射） */
const viewModules = import.meta.glob('/src/views/**/*.vue') as Record<string, () => Promise<unknown>>;

/**
 * 将路径转换为 PascalCase 路由名（用于 keep-alive include 与标签页）。
 * 例：`/system/user` → `SystemUser`
 */
function toPascalCase(input: string): string {
  return input
    .split(/[/\-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/** 归一化后端下发的组件路径 */
function normalizeComponentPath(component?: string | null): string | undefined {
  if (!component) {
    return undefined;
  }
  const normalized = component
    .replace(/^\/+/, '')
    .replace(/^src\//, '')
    .replace(/^views\//, '')
    .replace(/\.vue$/, '');
  return normalized || undefined;
}

/** 依据后端组件路径解析懒加载组件 */
function resolveComponent(component?: string | null): (() => Promise<unknown>) | undefined {
  const normalized = normalizeComponentPath(component);
  if (!normalized) {
    return undefined;
  }
  const key = `/src/views/${normalized}.vue`;
  const loader = viewModules[key];
  if (!loader) {
    console.warn(`[permission] 未找到菜单组件: ${key}`);
    return undefined;
  }
  return loader;
}

/** 递归收集按钮权限码（F 节点） */
function collectButtonPermissions(menus: MenuNode[], bucket: string[]): void {
  menus.forEach((menu) => {
    if (menu.menuType === 'F' && menu.permission) {
      bucket.push(menu.permission);
    }
    if (menu.children?.length) {
      collectButtonPermissions(menu.children, bucket);
    }
  });
}

/**
 * 将菜单树映射为动态路由（相对路径，挂载到根 Layout 下）。
 *
 * @param menus 菜单树
 * @param parentPath 父级完整路径
 */
function buildRoutes(menus: MenuNode[], parentPath: string): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];
  menus.forEach((menu) => {
    // 按钮节点不生成路由；禁用菜单跳过
    if (menu.menuType === 'F' || menu.status === 0) {
      return;
    }
    const segment = (menu.path ?? '').replace(/^\/+/, '');
    if (!segment) {
      // 无 path 的目录，直接下沉子级
      if (menu.children?.length) {
        routes.push(...buildRoutes(menu.children, parentPath));
      }
      return;
    }
    const fullPath = `${parentPath}/${segment}`.replace(/\/{2,}/g, '/');
    const routeName = toPascalCase(fullPath);
    const meta: AppRouteMeta = {
      title: menu.menuName,
      icon: menu.icon ?? undefined,
      keepAlive: menu.keepAlive === 1,
      hidden: menu.visible === 0,
      permission: menu.permission ?? undefined,
    };
    const children = menu.children?.length ? buildRoutes(menu.children, fullPath) : [];
    if (children.length > 0) {
      const firstSegment = (menu.children?.[0]?.path ?? '').replace(/^\/+/, '');
      routes.push({
        path: segment,
        name: routeName,
        component: RouterViewPassthrough,
        meta,
        redirect: menu.redirect || `${fullPath}/${firstSegment}`,
        children,
      } as RouteRecordRaw);
    } else {
      routes.push({
        path: segment,
        name: routeName,
        component: resolveComponent(menu.component) ?? RouterViewPassthrough,
        meta,
      } as RouteRecordRaw);
    }
  });
  return routes;
}

interface PermissionState {
  /** 生成的动态路由 */
  routes: RouteRecordRaw[];
  /** 是否已注入路由 */
  added: boolean;
  /** 菜单树中收集到的按钮权限码 */
  buttonPermissions: string[];
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    routes: [],
    added: false,
    buttonPermissions: [],
  }),

  actions: {
    /**
     * 依据菜单树生成动态路由并收集按钮权限码。
     *
     * @param menus 后端下发的菜单树
     * @returns 动态路由列表
     */
    generateRoutes(menus: MenuNode[]): RouteRecordRaw[] {
      const routes = buildRoutes(menus, '');
      const buttons: string[] = [];
      collectButtonPermissions(menus, buttons);
      this.routes = routes;
      this.buttonPermissions = Array.from(new Set(buttons));
      return routes;
    },

    /** 重置动态路由状态 */
    resetRoutes(): void {
      this.routes = [];
      this.added = false;
      this.buttonPermissions = [];
    },
  },
});
