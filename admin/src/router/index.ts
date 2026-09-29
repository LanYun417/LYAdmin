/**
 * 路由实例创建与全局守卫注册（history 模式、滚动复位到顶部）。
 */
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { constantRoutes } from './routes';
import { setupRouterGuard } from './guard';

/** 路由实例 */
const router: Router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 }),
});

// 注册全局守卫
setupRouterGuard(router);

export default router;
