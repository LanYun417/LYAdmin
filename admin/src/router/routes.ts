import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

/** 固定标签页（标签不可关闭）的路由路径白名单 */
export const AFFIX_TAB_PATHS: string[] = ['/home'];

/**
 * 静态路由表（无需权限即可注册）。
 * 动态业务路由由 permission store 依据菜单树生成后，注入到 name='Layout' 的根路由下。
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true },
  },
  {
    path: '/redirect',
    component: Layout,
    meta: { hidden: true },
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/redirect/index.vue'),
        meta: { hidden: true },
      },
    ],
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '无权限', hidden: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', hidden: true },
  },
  {
    path: '/500',
    name: 'ServerError',
    component: () => import('@/views/error/500.vue'),
    meta: { title: '服务器错误', hidden: true },
  },
  {
    path: '/',
    name: 'Layout',
    component: Layout,
    redirect: '/home',
    meta: { hidden: true },
    children: [],
  },
];

/** 兜底 404 路由（动态路由注入完成后追加，避免拦截未注册的动态路由） */
export const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'NotFoundCatchAll',
  redirect: '/404',
  meta: { hidden: true },
};
