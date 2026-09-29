/**
 * 权限 Store：依据后端菜单树生成动态路由并收集按钮权限码。
 */
import { defineComponent, h, ref } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { defineStore } from 'pinia';
import type { MenuNode } from '@/types/api';
import type { AppRouteMeta } from '@/types/router';
import { AFFIX_TAB_PATHS } from '@/router/routes';

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

/**
 * 路由名覆盖：path → 页面组件 defineOptions name。
 *
 * keep-alive 的 `:include` 按**组件名**匹配，而本文件默认用 `toPascalCase(path)`
 * 作为路由名。当某页面的组件名与该默认值不一致时（例如首页组件名为 `HomePage`
 * 而非默认的 `Home`），必须在此显式声明，否则首页的缓存不会命中。
 */
const ROUTE_NAME_OVERRIDES: Record<string, string> = {
  '/home': 'HomePage',
};

/** 解析路由名：优先使用覆盖表，否则回退到 PascalCase(path) */
function resolveRouteName(fullPath: string): string {
  return ROUTE_NAME_OVERRIDES[fullPath] ?? toPascalCase(fullPath);
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

/** 规范化路径：合并重复斜杠，去除末尾多余斜杠（根路径 `/` 保留） */
function normalizePath(input: string): string {
  const collapsed = input.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
}

/**
 * 计算节点自身的完整路径。
 * - `menu.path` 以 `/` 开头 → 视为绝对路径，直接采用（规范化多余斜杠）；
 * - 否则 → 与父路径拼接（父路径 + 子片段）。
 *
 * @param rawPath 菜单原始 path
 * @param parentPath 父级完整路径
 * @returns 规范化后的完整路径
 */
function resolveFullPath(rawPath: string, parentPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.startsWith('/')) {
    return normalizePath(trimmed);
  }
  const segment = trimmed.replace(/^\/+/, '');
  return normalizePath(`${parentPath}/${segment}`);
}

/**
 * 计算作为子路由注册时的相对片段（相对父级 fullPath）。
 * - 子项 fullPath 以 `${parentPath}/` 开头 → 去掉该前缀（避免路径重复拼接）；
 * - 否则回退为末段 `segment`。
 *
 * @param fullPath 子节点完整路径
 * @param parentPath 父级完整路径
 * @param segment 子节点 path 去除前导斜杠后的末段
 * @returns 供 vue-router 注册使用的相对路径片段
 */
function toChildPath(fullPath: string, parentPath: string, segment: string): string {
  const prefix = `${parentPath}/`;
  if (fullPath.startsWith(prefix)) {
    return fullPath.slice(prefix.length);
  }
  return segment;
}

/**
 * 找出首个可生成路由的子节点完整路径（用于目录节点 redirect）。
 *
 * @param menus 子节点列表
 * @param parentPath 父级完整路径
 * @returns 首个可路由子节点的完整路径；无则返回 undefined
 */
function firstRoutableFullPath(menus: MenuNode[] | undefined, parentPath: string): string | undefined {
  if (!menus?.length) {
    return undefined;
  }
  for (const child of menus) {
    if (child.menuType === 'F' || child.status === 0) {
      continue;
    }
    const rawPath = child.path ?? '';
    const segment = rawPath.replace(/^\/+/, '');
    if (!segment) {
      const deeper = firstRoutableFullPath(child.children, parentPath);
      if (deeper) {
        return deeper;
      }
      continue;
    }
    return resolveFullPath(rawPath, parentPath);
  }
  return undefined;
}

/**
 * 将菜单树映射为动态路由（相对路径，挂载到根 Layout 下）。
 *
 * 同时兼容后端下发的绝对路径（如 `/system/user`）与相对路径（如 `user`）两种形式：
 * 节点自身完整路径由 {@link resolveFullPath} 计算，而注册到 vue-router 的 `path`
 * 由 {@link toChildPath} 归一化为「相对父级 fullPath 的片段」，从根本上避免
 * 「父路径 + 绝对子路径」造成的重复拼接（如 `/system/system/user`）。
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
    const rawPath = menu.path ?? '';
    const segment = rawPath.replace(/^\/+/, '');
    if (!segment) {
      // 无 path 的目录，直接下沉子级
      if (menu.children?.length) {
        routes.push(...buildRoutes(menu.children, parentPath));
      }
      return;
    }
    const fullPath = resolveFullPath(rawPath, parentPath);
    const childPath = toChildPath(fullPath, parentPath, segment);
    const routeName = resolveRouteName(fullPath);
    const meta: AppRouteMeta = {
      title: menu.menuName,
      icon: menu.icon ?? undefined,
      keepAlive: menu.keepAlive === 1,
      hidden: menu.visible === 0,
      permission: menu.permission ?? undefined,
      affix: AFFIX_TAB_PATHS.includes(fullPath),
    };
    const children = menu.children?.length ? buildRoutes(menu.children, fullPath) : [];
    if (children.length > 0) {
      // 目录节点：redirect 指向第一个可路由子节点的完整路径
      routes.push({
        path: childPath,
        name: routeName,
        component: RouterViewPassthrough,
        meta,
        redirect: menu.redirect || firstRoutableFullPath(menu.children, fullPath),
        children,
      } as RouteRecordRaw);
    } else {
      routes.push({
        path: childPath,
        name: routeName,
        component: resolveComponent(menu.component) ?? RouterViewPassthrough,
        meta,
      } as RouteRecordRaw);
    }
  });
  return routes;
}

export const usePermissionStore = defineStore('permission', () => {
  /** 生成的动态路由 */
  const routes = ref<RouteRecordRaw[]>([]);
  /** 是否已注入路由 */
  const added = ref<boolean>(false);
  /** 菜单树中收集到的按钮权限码 */
  const buttonPermissions = ref<string[]>([]);

  /**
   * 依据菜单树生成动态路由并收集按钮权限码。
   *
   * @param menus 后端下发的菜单树
   * @returns 动态路由列表
   */
  function generateRoutes(menus: MenuNode[]): RouteRecordRaw[] {
    const builtRoutes = buildRoutes(menus, '');
    const buttons: string[] = [];
    collectButtonPermissions(menus, buttons);
    routes.value = builtRoutes;
    buttonPermissions.value = Array.from(new Set(buttons));
    return builtRoutes;
  }

  /** 重置动态路由状态 */
  function resetRoutes(): void {
    routes.value = [];
    added.value = false;
    buttonPermissions.value = [];
  }

  return {
    routes,
    added,
    buttonPermissions,
    generateRoutes,
    resetRoutes,
  };
});
