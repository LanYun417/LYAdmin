import type { Router } from 'vue-router';
import NProgress from 'nprogress';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { notFoundRoute } from './routes';

NProgress.configure({ showSpinner: false, trickleSpeed: 120 });

/** 免登录白名单 */
const WHITE_LIST: string[] = ['/login', '/403', '/404', '/500'];

/**
 * 注册全局前置/后置守卫：
 * - 未登录 → 跳登录页（白名单放行）
 * - 已登录访问 /login → 跳首页
 * - 首次进入 → 拉取用户信息 + 菜单树，生成并注入动态路由
 * - NProgress 进度条 + document.title
 *
 * @param router 路由实例
 */
export function setupRouterGuard(router: Router): void {
  router.beforeEach(async (to, _from, next) => {
    NProgress.start();

    const appTitle = import.meta.env.VITE_APP_TITLE || '蓝云后台管理系统';
    const pageTitle = (to.meta.title as string) || '';
    document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle;

    const userStore = useUserStore();
    const permissionStore = usePermissionStore();

    // 未登录
    if (!userStore.isLogin) {
      if (WHITE_LIST.includes(to.path)) {
        next();
      } else {
        next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
      }
      NProgress.done();
      return;
    }

    // 已登录访问登录页 → 首页
    if (to.path === '/login') {
      next('/dashboard');
      NProgress.done();
      return;
    }

    // 动态路由已注入 → 放行
    if (permissionStore.added) {
      next();
      return;
    }

    // 首次进入：加载用户信息 + 生成动态路由
    try {
      await userStore.loadUserInfo();
      const routes = permissionStore.generateRoutes(userStore.menus);
      routes.forEach((route) => router.addRoute('Layout', route));
      router.addRoute(notFoundRoute);
      permissionStore.added = true;
      // 合并按钮权限码（profile 权限码 ∪ 菜单 F 节点权限码）
      userStore.setPermissions([...userStore.permissions, ...permissionStore.buttonPermissions]);
      // 重新解析目标路由
      next({ path: to.path, query: to.query, hash: to.hash, replace: true });
    } catch (error) {
      userStore.resetState();
      permissionStore.resetRoutes();
      console.error('[router-guard] 加载用户信息失败', error);
      next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  });

  router.afterEach(() => {
    NProgress.done();
  });
}
