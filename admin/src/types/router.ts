import type { RouteRecordRaw } from 'vue-router';

/**
 * 路由 meta 元信息。
 * 扩展自 Record，兼容 vue-router 的 RouteMeta 约束。
 */
export interface AppRouteMeta extends Record<string, unknown> {
  /** 菜单/页面标题 */
  title?: string;
  /** Element Plus 图标组件名 */
  icon?: string;
  /** 是否在侧边栏隐藏 */
  hidden?: boolean;
  /** 是否被 keep-alive 缓存 */
  keepAlive?: boolean;
  /** 目录菜单是否始终显示根节点（即使只有一个子菜单） */
  alwaysShow?: boolean;
  /** 是否固定在标签页 */
  affix?: boolean;
  /** 高亮的菜单路径 */
  activeMenu?: string;
  /** 按钮/页面权限码 */
  permission?: string;
}

/** 动态路由记录类型别名 */
export type AppRouteRecordRaw = RouteRecordRaw;

/** 面包屑项 */
export interface BreadcrumbItem {
  title: string;
  path: string;
  redirect?: string;
}
