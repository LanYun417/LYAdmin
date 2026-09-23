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
  {
    /**
     * 兜底 404（静态注册）。
     * 必须是“组件型”而非 redirect 型：刷新时首次路由解析发生在
     * 动态路由注入之前，若无兜底会触发 vue-router 的
     * “No match found”警告；redirect 型会把 to.path 改写成 /404，
     * 导致守卫重解析时丢失原始目标（刷新 /home 会落在 404）。
     * 动态路由注入后，具体路由的匹配优先级高于 catch-all，不受影响。
     */
    path: '/:pathMatch(.*)*',
    name: 'NotFoundFallback',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', hidden: true },
  },
];
