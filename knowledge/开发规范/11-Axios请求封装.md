# 11 - Axios 请求封装

全站 HTTP 唯一出口：`src/api/request.ts`。业务层只调用 `get` / `post` / `put` / `del`，不直接 `new axios`。

## 统一响应体约定

后端统一响应：`{ code: 200, message: 'success', data: <T> }`（失败 `code` 为业务码，`data: null`）。拦截器**已解包**，业务层拿到的是 `data` 本身（业务失败时直接 reject）。

## 封装结构（核心）

```ts
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

// 请求拦截：注入 Bearer Token + 时区偏移头，自动处理 Content-Type
service.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('X-Timezone-Offset', String(new Date().getTimezoneOffset()));
  // FormData 交由浏览器带 boundary；否则默认 application/json
  return config;
});

// 响应拦截：解包 + 401 无感刷新 + 403 跳转 + 统一错误提示
service.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res === null || res === undefined || typeof res.code === 'undefined') return response.data; // 文件流等原样返回
    if (res.code === 200) return res.data;
    if (res.code === 401) { handleAuthFailure(); return Promise.reject(...); }
    if (res.code === 403) { ElMessage.error(res.message || '无访问权限'); redirectTo('/403'); return Promise.reject(...); }
    ElMessage.error(res.message || '请求失败');
    return Promise.reject(...);
  },
  async (error) => { /* 网络异常 / 401 无感刷新 / 403 跳转 */ },
);

export function get<T = unknown>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> { /* ... */ }
export function post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> { /* ... */ }
export function put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> { /* ... */ }
export function del<T = unknown>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> { /* ... */ }
```

## 设计要点

1. **泛型贯穿**：`get<UserInfo>('/user/info')` 返回值自动推导为 `UserInfo`，调用方不再写类型断言。
2. **拦截器内解包**：业务代码拿到的就是 `data`，不用每次 `.data.data`。
3. **错误分层**：业务错误（`code !== 200`）与 HTTP 错误（4xx/5xx/断网）分开处理，提示语统一在拦截器内弹出，组件只管 `try/catch` 后的流程分支。
4. **401 无感刷新**：首个 401 触发刷新接口（`/auth/refresh`），并发请求通过单飞标志 + 挂起队列重放；刷新失败则清理登录态跳转登录页。刷新接口本身排除在外避免死循环。
5. **403 跳转**：统一跳 `/403`（带命名空间的错误页），避免散落各处。
6. **路由内跳转（避免循环依赖）**：`request.ts` 通过 `setRequestRouter(router)` 注入路由实例（由 `main.ts` 调用），拦截器中用 `router.push` 而非整页刷新。直接 `import router` 会与 `router → guard → store → api/request` 形成循环依赖。
7. 二进制下载（`responseType: 'blob'`）在拦截器中按"非标准响应"直接放行。

## 调用示例

```ts
// store action 中
async function fetchUserInfo() {
  const data = await get<UserInfo>('/user/info');
  userInfo.value = data;
}

// 组件中需要感知失败时
try {
  await userStore.login(form);
  ElMessage.success('登录成功'); // 来自 @/utils/element
} catch {
  // 拦截器已提示，这里处理流程即可
}
```

## 常见错误

| 现象             | 原因                             | 解决                                               |
| ---------------- | -------------------------------- | -------------------------------------------------- |
| 返回类型对不上   | 拦截器解包后类型未断言           | 按 `request.ts` 的 `as unknown as Promise<T>` 处理 |
| 401 死循环刷新   | 刷新接口也被拦截重试             | 已在 `_retry` 与 url 包含 `/auth/refresh` 处排除   |
| 请求不带 token   | 登录后 token 未写入 localStorage | 由 `utils/auth.ts` 的 `setToken` 统一写入          |
| 整页刷新导致闪烁 | 拦截器用了 `window.location`     | 改用注入的 `router.push`（已实现）                 |
