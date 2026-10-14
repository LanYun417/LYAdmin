# 08 - Pinia 状态管理

## 规范：一律 Setup Store

```ts
// src/store/modules/user.ts
import { defineStore } from 'pinia';
import { get, post } from '@/api/request';

export const useUserStore = defineStore('user', () => {
  // state
  const token = ref<string>(getAccessToken() ?? '');
  const userInfo = ref<UserInfo | null>(null);

  // getters
  const isLoggedIn = computed(() => Boolean(token.value));
  const nickname = computed(() => userInfo.value?.nickname ?? '未登录');

  // actions
  async function login(params: LoginParams) {
    /* ... */
  }
  function logout() {
    /* ... */
  }

  return { token, userInfo, isLoggedIn, nickname, login, logout };
});
```

**为什么不用 Options Store**：Setup Store 与组合式 API 心智模型一致，`ref`/`computed` 类型推导天然完整，可在 store 内自由组合 VueUse。

## 持久化：pinia-plugin-persistedstate

项目已挂载 `pinia-plugin-persistedstate`（`src/store/index.ts`），需要持久化的 store 用 `persist` 选项声明：

```ts
export const useAppStore = defineStore(
  'app',
  () => {
    const isDark = ref(false);
    // ...
    return { isDark /* ... */ };
  },
  {
    persist: {
      key: 'ly_admin_app',
      paths: ['isDark'], // 仅持久化需要的字段
    },
  },
);
```

> 注意：`user` store 的登录态由 `utils/auth.ts` 写入 `localStorage`（key `ly_admin_user`），登出时由请求层统一清理（见 11）。二者不要重复持久化。

## 使用侧约定

```vue
<script setup lang="ts">
import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();
// 解构 state/getter 必须用 storeToRefs 保持响应性；方法可直接解构
const { nickname, isLoggedIn } = storeToRefs(userStore);
const { logout } = userStore;
</script>
```

## 目录约定

`src/store/`：`index.ts`（Pinia 实例 + 持久化插件）与 `modules/*.ts`（按领域拆分：`app` / `user` / `permission` / `tagsView`）。

## 最佳实践

1. 按**领域**拆分 store，禁止一个巨型 store；store id 与文件名一致（`user.ts` → `defineStore('user', ...)`）。
2. 异步请求只在 action 中发起，组件不直接调 request。
3. 需要持久化的字段用 `persist` 选项，而不是手写 localStorage 同步。
4. 跨组件共享的响应式逻辑优先放 `src/composables/`，store 只放全局/跨路由状态。

## 常见错误

| 现象                   | 原因                             | 解决                                                  |
| ---------------------- | -------------------------------- | ----------------------------------------------------- |
| 解构后失去响应性       | 直接解构 state                   | 改用 `storeToRefs`                                    |
| `getActivePinia` 报错  | 在 pinia 安装前调用 store        | 确保 `app.use(pinia)` 在 mount 前（`main.ts` 已处理） |
| `defineStore` 报未定义 | 手动 import 被删但自动导入未生效 | 重启 dev 生成 d.ts；禁止手动 import（见 06）          |
