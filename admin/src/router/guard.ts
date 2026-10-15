/**
 * 全局路由守卫：登录态校验、动态路由首次注入、路由级权限校验与标题维护。
 *
 * 说明：顶部进度条（NProgress）已改由 axios 请求驱动（见 `api/request.ts`），
 * 不再在此维护——路由跳转本身不产生网络请求（懒加载 chunk 走打包器），
 * 而页面数据加载一律经由 axios，挂在请求上更贴合「在等后端」这一真实语义。
 */
import type { Router } from 'vue-router';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { hasPermission } from '@/utils/permission';

/** 免登录白名单 */
const WHITE_LIST: string[] = ['/login', '/403', '/404', '/500'];

/**
 * 注册全局前置守卫：
 * - 未登录 → 跳登录页（白名单放行）
 * - 已登录访问 /login → 跳首页
 * - 首次进入 → 拉取用户信息 + 菜单树，生成并注入动态路由
 * - 维护 document.title
 *
 * @param router 路由实例
 */
export function setupRouterGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const appTitle = import.meta.env.VITE_APP_TITLE || '蓝云后台管理系统';
    const pageTitle = (to.meta.title as string) || '';
    document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle;

    const userStore = useUserStore();
    const permissionStore = usePermissionStore();

    // 未登录
    if (!userStore.isLogin) {
      return WHITE_LIST.includes(to.path) ? true : `/login?redirect=${encodeURIComponent(to.fullPath)}`;
    }

    // 已登录访问登录页 → 首页
    if (to.path === '/login') {
      return '/home';
    }

    // 动态路由已注入 → 校验路由级权限后放行
    if (permissionStore.added) {
      // 路由 meta.permission 来自菜单节点权限码（见 permission store 的 buildRoutes）。
      // 已登录但当前用户不具备该权限码时，跳转 403（语义正确），而非落到 catch-all 的 404。
      // 超管 permissions 含 '*'，hasPermission 直接放行，不会被误拦。
      const required = to.meta.permission as string | undefined;
      if (required && !hasPermission(required)) {
        // 路由内跳转（返回目标路径），不做整页刷新，保留 tagsView 已打开标签与表单状态
        return '/403';
      }
      return true;
    }

    // 首次进入：加载用户信息 + 生成动态路由
    try {
      await userStore.loadUserInfo();
      const routes = permissionStore.generateRoutes(userStore.menus);
      routes.forEach((route) => router.addRoute('Layout', route));
      permissionStore.added = true;
      // 合并按钮权限码（profile 权限码 ∪ 菜单 F 节点权限码）
      userStore.setPermissions([...userStore.permissions, ...permissionStore.buttonPermissions]);
      // 重新解析目标路由
      return { path: to.path, query: to.query, hash: to.hash, replace: true };
    } catch (error) {
      userStore.resetState();
      permissionStore.resetRoutes();
      console.error('[router-guard] 加载用户信息失败', error);
      return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
    }
  });
}
