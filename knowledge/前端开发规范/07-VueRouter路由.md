# 07 - Vue Router 路由

## 配置结构

路由实例见 `src/router/index.ts`，由 `routes`（静态表 `src/router/routes.ts`）与全局守卫（`src/router/guard.ts`）组成：

```ts
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { constantRoutes } from './routes';
import { setupRouterGuard } from './guard';

const router: Router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 }),
});

setupRouterGuard(router);
export default router;
```

## 约定

1. **懒加载一律 `() => import()`**：每个页面独立分包，首屏只加载必要 chunk。
2. **命名路由**：跳转用 `router.push({ name: 'Xxx' })`，路径变更时无需改调用方。
3. **meta 语义化**：`title`（动态标题）、`requiresAuth`（鉴权）等保留字段；业务侧按需在 `src/types` 的 `RouteMeta` 扩展中补充。
4. 组件内 `useRoute` / `useRouter` 自动导入（见 06）；`createRouter` 等装配代码显式 import。
5. **动态路由**：菜单树由后端按角色下发，前端在守卫中根据权限动态 `addRoute`（见 `router/guard.ts` 与 `store/modules/permission`）。

## 守卫与请求层协同

`src/api/request.ts` 处于依赖链底层（router → guard → store → api/auth → api/request），若直接 `import router` 会形成循环依赖。因此采用**注入式**：`main.ts` 在创建路由后调用 `setRequestRouter(router)` 注入，`request.ts` 仅在拦截器运行时读取实例，实现 401/403 的「路由内跳转」而非整页刷新。

## meta 类型扩展

```ts
// src/types/router.d.ts（按需添加）
export {};
declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
  }
}
```

## 常见错误

| 现象               | 原因                         | 解决                                                                                                             |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 生产环境刷新 404   | history 模式服务端未配置回退 | 同源部署由后端托管 `ly-admin-api/web` 并做 `index.html` 回退；分离部署 Nginx `try_files $uri $uri/ /index.html;` |
| 守卫里拿不到 store | 守卫先于 pinia 安装          | 守卫内 `useXxxStore()` 调用即可（pinia 已激活）                                                                  |
| 跳转后 title 不变  | 漏写 meta.title              | 统一在路由表中补全                                                                                               |
| 菜单为空           | 角色未授权 / 种子未写入      | `cd ly-admin-api && npm run seed`；角色管理勾选菜单授权                                                          |
