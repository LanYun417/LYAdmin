# 蓝云后台管理系统（LYAdmin）· 代码规范

> 版本：v1.0 ｜ 维护：架构师 高见远（Gao）
> 上游依据：[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)（第 6 节「统一约定」为本文的契约来源）
> 适用范围：根目录工程规范、后端 `api/`（Express 5 + TypeScript + Sequelize）、前端 `admin/`（Vue 3.5 + TypeScript + Element Plus + Tailwind v3）。
> 本文所有规则均**以仓库真实配置与源码为准**（`eslint.config.mjs` / `.prettierrc.json` / `.stylelintrc.json` / `tsconfig.json` 等），不是通用模板。

---

## 1. 总则

1. **TypeScript 严格模式**：前后端 `tsconfig.json` 均开启 `"strict": true` 与 `"noImplicitAny": true`，禁止用 `any` 绕过类型（后端因 Sequelize 动态查询放宽 `no-explicit-any`，前端保持 `warn`）。
2. **单一职责**：一个文件只承担一个明确职责；一个函数只做一件事。后端严格分层（见第 4 节），前端组件按「页面 / 业务组件 / 通用组件」划界。
3. **可读性优先**：命名见名知义，避免魔法值（统一收敛到 `api/src/constants`），复杂逻辑必须写注释（见第 5 节）。
4. **零容忍未通过 lint 的提交**：根目录 `npm run lint`（`eslint . --max-warnings 0`）必须零错误、零警告；提交前钩子 `pre-commit` 会再次拦截（见第 8 节）。
5. **不重复造轮子**：能用工具链默认行为解决的，不写自定义配置；能复用的先看 `admin/src/hooks`、`admin/src/components`、`api/src/utils`。

---

## 2. 命名规范

| 对象                          | 规范                                          | 正例                                    | 反例                                       |
| ----------------------------- | --------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| 目录（前端页面/组件）         | kebab-case                                    | `views/system/user/`                    | `views/System/User/`                       |
| Vue 组件文件                  | PascalCase                                    | `UserForm.vue`                          | `userForm.vue`、`user-form.vue`            |
| 其余 TS/JS 文件               | camelCase 或 kebab-case（与现有目录一致）     | `request.ts`、`user.service.ts`         | `Request.ts`、`UserService.ts`             |
| Vue 组件名（`defineOptions`） | PascalCase                                    | `defineOptions({ name: 'SystemUser' })` | `'system-user'`                            |
| 变量 / 函数                   | camelCase                                     | `getUserList`、`loading`                | `get_user_list`、`Loading`                 |
| 常量                          | UPPER_SNAKE_CASE                              | `ERROR_CODE`、`PAGINATION`              | `errorCode`、`pagination`                  |
| 类型 / 接口                   | PascalCase（不加 `I` 前缀）                   | `UserDetail`、`PageResult`              | `IUserDetail`、`userDetail`                |
| 枚举                          | PascalCase，成员 UPPER_SNAKE                  | `enum MenuType { DIRECTORY = 'M' }`     | `enum menu_type`                           |
| 布尔量                        | 以 `is/has/can/should` 开头                   | `isLogin`、`hasPermission`              | `login`、`flag`                            |
| 数据库表 / 列                 | snake_case（`sys_` 前缀）                     | `sys_user`、`created_at`                | `SysUser`、`createdAt`（列名）             |
| 模型属性                      | camelCase（`underscored: true` 自动映射列名） | `lastLoginAt` ↔ `last_login_at`         | 直接写 `last_login_at` 作属性              |
| 权限码                        | `模块:子模块:动作`                            | `system:user:add`                       | `userAdd`、`system-user-add`               |
| 事件处理函数                  | `handle` + 动作                               | `handleSearch`、`handleDelete`          | `search()`、`onDelete`（后者留给组件事件） |
| Pinia getter                  | 名词/形容词                                   | `isLogin`、`nickname`                   | `getIsLogin()`                             |
| Pinia action                  | 动词短语                                      | `fetchProfile`、`resetState`            | `profile()`                                |
| 组件 Props                    | camelCase                                     | `roleOptions`、`userId`                 | `role_options`                             |
| 组件 Emits                    | `update:xxx` / 动词                           | `update:visible`、`success`             | `change`（含糊）                           |
| CSS class（scoped）           | kebab-case                                    | `.table-title`、`.user-page`            | `.tableTitle`                              |
| Vite 环境变量                 | `VITE_` 前缀 UPPER_SNAKE                      | `VITE_API_BASE_URL`                     | `apiBaseUrl`                               |
| 菜单类型                      | `M` 目录 / `C` 菜单 / `F` 按钮                | `MenuType.BUTTON = 'F'`                 | `button`、`1`                              |

> 补充：模型属性 ↔ 列名的映射规则、权限码完整清单见 [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) 第 4.1 / 6.6 节，此处不重复。

---

## 3. 前端规范（Vue 3.5 + TypeScript）

### 3.1 组件写法

- **一律使用 `<script setup lang="ts">` + 组合式 API**，禁止 Options API（`export default { data() {} }`）。
- 组件顺序固定为 **`<script setup>` → `<template>` → `<style>`**（`vueIndentScriptAndStyle: false`）。
- 每个页面/组件必须用 `defineOptions({ name: 'XxxYyy' })` 显式声明组件名（供 `keep-alive` 缓存与 devtools 识别）。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineOptions({ name: 'SystemUser' });

const loading = ref(false);
</script>
```

### 3.2 组件划分原则

| 类型     | 位置                            | 判定标准                                                              |
| -------- | ------------------------------- | --------------------------------------------------------------------- |
| 页面组件 | `admin/src/views/**/index.vue`  | 与路由一一对应，负责编排                                              |
| 业务组件 | `views/<模块>/components/*.vue` | 只服务单个业务模块（如 `UserForm.vue`）                               |
| 通用组件 | `admin/src/components/**`       | 跨模块复用（`Pagination` / `SearchForm` / `IconPicker` / `MenuTree`） |

- 通用组件会被 `unplugin-vue-components` 按 `dirs: ['src/components']` 自动注册，**无需手动 import**（页面内使用 `UserForm` 这类业务组件仍需显式 import）。
- Props / Emits 必须带类型；使用 `defineProps<Props>()` 泛型写法，避免运行时 `props: {}` 对象。

```ts
interface Props {
  visible: boolean;
  userId?: number;
  roleOptions: RoleBrief[];
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'success'): void; (e: 'update:visible', v: boolean): void }>();
```

- 弹窗类组件统一用 `v-model` 控制显隐（`defineModel` 或 `update:visible`），父组件用 `v-model="formVisible"`。

### 3.3 状态管理（Pinia）约定

- Store 文件位于 `admin/src/store/modules/`，**按领域拆分**：`user` / `permission` / `app` / `tagsView`；统一在 `store/index.ts` 挂载 `pinia-plugin-persistedstate`。
- **本项目统一使用 Setup Store（组合式）写法**：与项目其余代码（`<script setup>` + 组合式 API）保持同一心智模型。用 `ref` 声明 state、`computed` 声明 getter、普通函数声明 action，最终统一 `return`。
- **每个 state ref 必须显式标注类型**（如 `ref<boolean>(false)`、`ref<UserDetail | null>(null)`、`ref<string[]>([])`），并给每个字段写行内注释。
- **必须 `return` 全部 state + getter + action**：这是 Setup Store 的硬约束 —— 漏 return 任意一个 state 字段会导致 devtools 与 `pinia-plugin-persistedstate` **静默失效**，非常难以排查。
- **何时该进 Store**：跨页面共享、需要跨路由存活、需要持久化的状态（登录态、权限码、菜单树、侧边栏折叠、暗黑模式）。
- **何时不该进 Store**：仅本页面使用的列表数据 / 弹窗显隐 / 表单状态，用 `ref` / `reactive` 留在组件内。
- 持久化只持久必要字段，禁止整包落库；`persist` 作为 `defineStore` 的**第三个参数**传入：

```ts
// admin/src/store/modules/user.ts
export const useUserStore = defineStore(
  'user',
  () => {
    /** 访问令牌 */
    const accessToken = ref<string>(getAccessToken());
    /** 刷新令牌 */
    const refreshToken = ref<string>(getRefreshToken());
    // ... 其余 state / getter / action

    return { accessToken, refreshToken /* , ...其余成员必须全部 return */ };
  },
  {
    persist: { key: 'ly_admin_user', pick: ['accessToken', 'refreshToken'] },
  },
);
```

### 3.4 请求层约定

- axios 实例位于 **`admin/src/api/request.ts`**（不是 `utils/`）；各业务接口按模块放 `admin/src/api/<module>.ts`（`auth` / `user` / `role` / `menu` / `log` / `file` / `dashboard` / `profile`）。
- 实例配置：`baseURL = import.meta.env.VITE_API_BASE_URL || '/api'`，`timeout: 15000`。
- **响应拦截器已解包**：`code === 200` 时直接返回 `res.data`，业务代码拿到的就是 data，不要再判断 `code`。
- 统一错误处理（在拦截器内完成，业务层不重复）：

| 情况                      | 处理                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `code === 200`            | 返回 `data`                                                                                   |
| `code === 401` / HTTP 401 | 触发**无感刷新**（单飞 `isRefreshing` + 挂起队列 `pendingQueue`），失败则清 Token 跳 `/login` |
| `code === 403` / HTTP 403 | `ElMessage.error` 后跳 `/403`                                                                 |
| 网络异常 / 超时           | `ElMessage.error('网络异常，请稍后重试')`                                                     |
| 其他非 200                | `ElMessage.error(message)` 并 reject                                                          |

- 上传（`FormData`）时请求拦截器会**删除 `Content-Type`**，交由浏览器补 `multipart boundary`，业务代码不要手写 `Content-Type`。
- 业务层调用统一用封装的 `get/post/put/del<T>()`，泛型标注返回类型；失败路径由拦截器负责提示，业务层 `try/catch` 只处理流程控制。

### 3.5 样式约定

- **Tailwind 原子类优先**：布局 / 间距 / flex / 栅格 / 文本等用 Tailwind（如 `flex items-center justify-between mb-3`）。
- **`tailwind.config.js` 已设 `corePlugins: { preflight: false }`**：Tailwind 不做全局重置，以免破坏 Element Plus 组件默认样式。因此：
  - 不要假设 Tailwind 会重置 `margin` / `box-sizing`；全局最小重置写在 `admin/src/styles/index.css` 的 `@layer base`。
  - 不要用 Tailwind 原子类强行覆盖 **Element Plus 组件内部外观**；确需覆盖时在 `admin/src/styles/element.scss` 内写带命名空间的样式，而非 `!important`。
- **何时写 `<style scoped>`**：仅当需要少量与组件强相关的静态样式（如 `.table-title` 字号/字重/颜色），且无法用 Tailwind 工具类表达时。
- **暗黑模式**：Tailwind `darkMode: 'class'` 与 Element Plus 的 `html.dark` 方案对齐，由 VueUse `useDark` 统一切换，不要另起一套 `data-theme`。
- **样式引入顺序**（`admin/src/main.ts`，不可调整）：
  1. `element-plus/dist/index.css`
  2. `element-plus/theme-chalk/dark/css-vars.css`
  3. `nprogress/nprogress.css`
  4. `@/styles/index.css`（Tailwind 入口 + base 重置）
  5. `@/styles/element.scss`（EP 覆盖）

### 3.6 自动导入约定

- 由 `vite.config.ts` 的 `unplugin-auto-import`（`imports: ['vue','vue-router','pinia','@vueuse/core']`）与 `unplugin-vue-components`（`ElementPlusResolver` + `dirs: ['src/components']`）实现按需自动导入。
- 生成的两个类型声明文件 **`admin/src/auto-imports.d.ts` 与 `admin/src/components.d.ts` 必须纳入版本管理**，原因：
  1. 二者被 `admin/tsconfig.json` 的 `include` 引用，是 `vue-tsc` / IDE 类型推断的依据；不入库会导致 CI 与其他成员类型检查失败。
  2. `npm run build` 会先执行 `vue-tsc --noEmit`，缺少声明文件会直接编译报错。
- 注意：这两个文件已被 `eslint.config.mjs` 的 `ignores` 排除，**不要手动编辑**；如需刷新，删除后重跑 `npm run dev` 自动生成。

### 3.7 TypeScript 通用约定

- 优先用 `interface` 描述对象结构（可扩展），用 `type` 描述联合/工具类型/函数签名。
- 泛型参数命名用有意义的单词（`T` 仅用于极简场景），如 `request<T = unknown>()`。
- 禁止用 `as any` 绕过类型；确需断言时用 `as unknown as T` 并注释原因。
- 类型定义放 `admin/src/types/`（`index.ts` 统一导出、`api.ts` 放 DTO、`router.ts` 放路由 meta）；组件私有类型就近定义。
- 字符串字面量联合优于裸 `string`（如状态值 `1 | 0`）。
- `enum` 用于后端常量（`MenuType` / `Status` / `LogResult`）；前端倾向字面量联合或 `as const` 对象。

### 3.8 页面开发范式（列表页）

以 `admin/src/views/system/user/index.vue` 为准，列表页遵循固定结构：

| 区块   | 约定                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| 查询区 | 用通用组件 `SearchForm`，`@search` / `@reset` 事件；查询参数放 `reactive`                 |
| 操作区 | 主按钮用 `v-permission="'system:user:add'"` 控制显隐                                      |
| 表格区 | `el-table` + `v-loading`，`prop` 与字段对齐，敏感/长文本用 `show-overflow-tooltip`        |
| 分页区 | 用通用组件 `Pagination`，`v-model:page` / `v-model:page-size`                             |
| 弹窗区 | 业务组件（`UserForm` / `AssignRoleDialog`）用 `v-model` 控制显隐，`@success` 回调刷新列表 |

约定要点：

- 列表加载统一 `loadList()`，`loading.value = true` 放 `try`、`finally` 复位。
- 删除/重置密码等危险操作先 `ElMessageBox.confirm`，用户取消（`catch`）直接 `return`，不报错。
- 状态切换采用「先请求、成功后改本地」或「失败保持原状」，不做乐观更新回滚的复杂逻辑。
- 时间展示统一 `formatDateTime(row.lastLoginAt)`（`admin/src/utils/format.ts`），**不要**在模板里 `new Date()`。

### 3.9 指令、Hook 与工具函数约定

- 自定义指令放 `admin/src/directives/`，通过 `directives/index.ts` 的 `setupDirectives(app)` 统一注册；`v-permission` 用于按钮级显隐，值为权限码字符串。
- 可复用的组合式逻辑放 `admin/src/hooks/`（`useTable` / `useTheme`），命名以 `use` 开头，返回 `ref`/`reactive` 与操作函数。
- 纯函数工具放 `admin/src/utils/`，必须无副作用、可单测；按职责拆文件（`auth` 管 Token、`format` 管格式化、`permission` 管权限判定、`validate` 管表单规则与正则）。
- 工具函数优先从已有依赖取用（`dayjs`、`lodash-es`、`@vueuse/core`），不要重复实现。

---

## 4. 后端规范（Express 5 + TypeScript + Sequelize）

### 4.1 分层职责铁律

| 层         | 目录                   | 只做                                       | 不该出现                           |
| ---------- | ---------------------- | ------------------------------------------ | ---------------------------------- |
| Route      | `api/src/routes/`      | 挂载路径 + 串联中间件                      | 业务逻辑、SQL                      |
| Controller | `api/src/controllers/` | 解析 `req`、调 Service、用 `ok()` 组装响应 | `if/else` 业务判断、直接操作 Model |
| Service    | `api/src/services/`    | 业务逻辑、事务、**唯一操作 Model 的层**    | 读写 `req`/`res`、拼 HTTP 状态     |
| Model      | `api/src/models/`      | 字段映射、关联、`toJSON` 脱敏              | 业务查询、调用 Service             |

**反例（禁止）**：Controller 里写 `User.findOne(...)`；Service 里写 `res.json(...)`；Model 里写权限判断。

正例（真实代码，`api/src/controllers/user.controller.ts`）：

```ts
export async function list(req: Request, res: Response): Promise<void> {
  const result = await userService.listUsers(req.query as Record<string, unknown>);
  ok(res, result);
}
```

### 4.2 统一响应体与错误码

- 统一响应体 `{ code, message, data }`、业务错误码表、HTTP 状态码使用约定，**以 [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) 第 6.1~6.4 节为准**，本文不重复。
- Service 抛错统一用 `AppError`（`api/src/utils/response.ts`）：`AppError.notFound('用户不存在')`、`AppError.conflict('用户名已存在')`、`AppError.forbidden()`、`AppError.unauthorized()`。
- Controller 成功返回统一用 `ok(res, data, '新增成功')`，**禁止**手写 `res.json({ code: 200, ... })`。
- 错误码常量统一从 `@/constants` 的 `ERROR_CODE` 引用，禁止散落魔法数字。

### 4.3 参数校验（zod）

- 所有入参 schema 放 `api/src/validators/<module>.validator.ts`，用 `z.coerce` 处理 query/params 的字符串转数字。
- 通过 `validate({ body, query, params })` 中间件挂载；校验失败由中间件抛 `400`。
- 从 schema 导出类型，Service/Controller 复用，避免重复定义：

```ts
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### 4.4 中间件顺序约定

**应用级（`api/src/app.ts`）**：

```
cors → morgan(文件+控制台) → express.json/urlencoded → express.static('/uploads')
     → operationLog → 健康检查 /api → 业务路由 /api → notFoundHandler → errorHandler
```

**路由级（每个业务路由，`api/src/routes/*.routes.ts`）**：

```
router.use(authenticate)                       // 1. 鉴权（校验 accessToken + 查库校验 status，强制下线）
  → requirePermission('system:user:add')       // 2. 权限（权限码，超管直通）
  → validate({ body: createUserSchema })       // 3. 校验（zod）
  → asyncHandler(controller.create)            // 4. 业务（asyncHandler 统一异常传递）
```

- `errorHandler` 必须是最后一个中间件；`notFoundHandler` 在其前。
- 写操作由 `operationLog` 统一记录（密码类字段按 `SENSITIVE_KEYS` 脱敏）。

### 4.5 Sequelize 约定

- 实例统一开启 `underscored: true`（`api/src/config/database.ts`）：模型属性 **camelCase** ↔ 数据库列 **snake_case**（`createdAt` ↔ `created_at`）。
- 常规列**无需**手写 `field`；仅特殊列显式声明，如 `User.lastLoginAt` → `field: 'last_login_at'`。
- 状态类字段统一 `TINYINT`（`1` 启用/成功，`0` 禁用/失败），引用 `Status` / `LogResult` 枚举。
- 敏感字段（`password`、`passwordChangedAt`）在模型 `toJSON()` 中剔除，禁止直接 `res.json(user)`。

> ⚠️ **踩坑警示（本项目真实问题）**：`col()` 在 `raw: true` 下**不做属性名 → 列名的映射**，必须写**真实数据库列名（snake_case）**。
> 反例：`fn('COUNT', col('userId'))` 在 `raw: true` 查询中会报 `Unknown column 'userId'`。
> 正例（`api/src/services/dashboard.service.ts`）：`fn('COUNT', col('user_id'))`。

### 4.6 时区约定

- `api/src/config/database.ts` 设置了 `timezone: '+08:00'`，并配合 `dialectOptions: { typeCast: true }`（**未开启 `dateStrings`**），因此 DATETIME 字段以 **JS `Date` 对象**返回，与模型声明（`Date | null`）一致。

> ⚠️ **踩坑警示（本项目真实问题）**：时区错位的风险点是「用 `new Date(str)` 解析**字符串**形式的时间」。
> 形如 `'2026-09-22 16:41:00'` 的字符串（不带时区后缀）若交给 `new Date(str)` 解析，会按运行环境时区二次换算，导致 **8 小时偏差**。
> 当前 `dialectOptions` 未开启 `dateStrings`，模型字段本身即 `Date` 对象，`new Date(dateObj)` 属安全等价操作；但仍**禁止对外部传入的字符串时间直接 `new Date(str)`**。
> 正确做法：字符串时间统一用 `dayjs`（前后端均依赖）解析，或直接在 SQL 侧比较；展示用 `admin/src/utils/format.ts` 的 `formatDateTime`。

### 4.7 错误处理与日志约定

- Service 只负责**抛业务错误**（`AppError`），不 try/catch 吞异常；未捕获异常由 `errorHandler` 中间件统一兜底为 `500`。
- Controller 用 `asyncHandler` 包裹，保证 async 异常能传递到 `errorHandler`。
- 业务错误消息写**用户可读中文**（如 `'用户名已存在'`），前端直接 `ElMessage.error(message)` 展示。
- HTTP 访问日志由 `morgan` 输出到控制台 + `logs/access.log`（JSON Lines）；操作日志由 `operationLog` 中间件异步落库，**均不在业务代码里手写日志**。
- `console.log` 仅用于启动/种子等一次性提示；禁止用 `console.log` 代替错误处理。

### 4.8 查询与分页约定

- 分页统一用 `api/src/utils/pagination.ts` 的 `parsePagination()` 解析、`buildPageResult()` 组装，返回值结构 `{ list, total, page, pageSize }`。
- 关联查询用 `include` + `through: { attributes: [] }`（多对多中间表不返回冗余字段）；`findAndCountAll` 配 `distinct: true` 保证计数正确。
- 排序显式声明（如 `order: [['id', 'DESC']]`），不依赖数据库默认顺序。
- 条件构造用 `Op`（`Op.like` / `Op.between`），禁止字符串拼接 SQL。
- 聚合统计（`fn` + `group` + `raw`）务必遵守 4.5 的 `col()` 列名警示。
- 唯一冲突（用户名/角色编码重复）在 Service 显式判重并抛 `AppError.conflict()`，不要依赖数据库报错。

### 4.9 安全与敏感数据处理

- 密码**只以 bcrypt 哈希存储**（`api/src/utils/password.ts` 的 `hashPassword` / `comparePassword`），任何日志、响应、日志入库都不得出现明文。
- 模型 `toJSON()` 必须剔除敏感字段（`User` 已剔除 `password`、`passwordChangedAt`）；返回用户信息一律经 Service 转 DTO（`toUserBrief` / `toUserDetail`），禁止直接回传 Model 实例。
- 操作日志入库前按 `SENSITIVE_KEYS`（`password` / `oldPassword` / `newPassword` / `confirmPassword`）脱敏。
- 上传严格校验 MIME 与扩展名白名单（`UPLOAD_ALLOWED_MIME` / `UPLOAD_ALLOWED_EXT`）与大小/数量上限，禁止信任客户端文件名。
- 内置超管账号 `admin` 受保护：禁止删除、禁止禁用（`user.service.ts` 中 `BUILTIN_ADMIN` 判定）。

### 4.10 配置与常量约定

- 所有环境变量经 `api/src/config/index.ts` 集中读取并做默认值兜底，业务代码通过 `config.xxx` 访问，**不直接读 `process.env`**。
- 魔法值统一收敛到 `api/src/constants/index.ts`（错误码、枚举、正则、白名单、分页默认值）；正则集中在 `REGEX`。
- 新增常量须同步补充注释；枚举成员用 `UPPER_SNAKE`。

---

## 5. 注释规范

| 场景          | 要求                                        | 示例                                                              |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| 文件头        | 每个模块首行用块注释说明「模块职责」        | `/** 用户服务。模块职责：...（唯一操作 User/Role 关联的层）。 */` |
| 导出函数      | JSDoc，含 `@param` / `@returns` / `@throws` | 见 `user.service.ts` 的 `listUsers`                               |
| 导出常量/枚举 | 单行 `/** */` 说明用途                      | `/** 超级管理员角色编码（不受权限裁剪）。 */`                     |
| 复杂逻辑      | 行内 `//` 说明「为什么」，而非「做什么」    | 如请求拦截器删除 `Content-Type` 的原因                            |
| 类型字段      | 接口属性逐条 `/** */`                       | `interface UserState { /** 访问令牌 */ accessToken: string }`     |
| TODO          | 统一格式 `// TODO(责任人): 待办内容`        | `// TODO(gao): 补充导出 CSV`                                      |

- 注释用**简体中文**，与现有代码风格一致。
- 禁止无意义注释（如 `// 设置 loading`）；禁止注释掉的死代码入库。

---

## 6. 导入顺序

- 分组（组间空一行），与 ESLint/Prettier 配置一致：

```
1) 第三方包（node / vue / element-plus / axios ...）
2) 内部绝对路径别名 @/...（api：@/*；admin：@/*）
3) 相对路径（./ ../）
4) 样式导入（admin 专用，最后）
```

- 类型导入用 `import type { ... }`（`isolatedModules` 要求）。
- 后端装饰器相关：`server.ts` 首行必须 `import 'reflect-metadata';`（sequelize-typescript 依赖）。
- 未使用的变量：以 `_` 前缀命名即可豁免 `@typescript-eslint/no-unused-vars`（`argsIgnorePattern: '^_'`）。

示例（前端页面组件，符合实际导入顺序）：

```ts
// 1) 第三方
import { onMounted, reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
// 2) 内部别名（ElMessage/ElMessageBox 等命令式 API 一律走 `@/utils/element` 桶，禁止从包根 `element-plus` 整库引入）
import { ElMessage, ElMessageBox } from '@/utils/element';
import { getUserListApi } from '@/api/user';
import { getAllRolesApi } from '@/api/role';
import type { UserDetail } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
// 3) 相对路径
import UserForm from './components/UserForm.vue';
```

> 注意：`Pagination` 等 `src/components` 下的通用组件会被自动导入，实际代码中通常无需显式 import；上面保留是为了演示分组顺序。

---

## 7. 提交前检查清单

> 逐项勾选，全部通过才允许提交（`pre-commit` 会自动跑第 1~2 项）。

| #   | 检查项       | 命令 / 方式                      | 通过标准                                       |
| --- | ------------ | -------------------------------- | ---------------------------------------------- |
| ☐ 1 | 全仓 ESLint  | `npm run lint`（根目录）         | 零 error、零 warning（`--max-warnings 0`）     |
| ☐ 2 | 样式 Lint    | `npm run stylelint`（根目录）    | 零 error                                       |
| ☐ 3 | 格式化       | `npm run format:check`（根目录） | 全部文件已格式化                               |
| ☐ 4 | 后端类型检查 | `cd api && npm run typecheck`    | 无类型错误                                     |
| ☐ 5 | 前端类型检查 | `cd admin && npm run type-check` | 无类型错误                                     |
| ☐ 6 | 本地自测     | 启动前后端跑通所改功能           | 无控制台报错、接口行为正确                     |
| ☐ 7 | 提交信息     | `npm run commit`（cz-git 交互）  | 符合 Conventional Commits（见 GIT-CONVENTION） |
| ☐ 8 | 未误提交     | `git status`                     | 无 `.env`、`uploads/`、`logs/`、`dist/`        |

> 格式化失败时用 `npm run format` / `npm run lint:fix` / `npm run stylelint:fix` 一键修复后再提交。

---

## 8. 工具链说明

| 工具             | 负责                            | 配置                                     | 运行命令（根目录，均为真实 script）           |
| ---------------- | ------------------------------- | ---------------------------------------- | --------------------------------------------- |
| **ESLint**       | JS/TS/Vue 代码质量与潜在错误    | `eslint.config.mjs`（flat config）       | `npm run lint` / `npm run lint:fix`           |
| **Prettier**     | 统一代码格式                    | `.prettierrc.json` / `.prettierignore`   | `npm run format` / `npm run format:check`     |
| **Stylelint**    | CSS/SCSS/Vue 样式质量与属性排序 | `.stylelintrc.json` / `.stylelintignore` | `npm run stylelint` / `npm run stylelint:fix` |
| **husky**        | Git Hooks 装配                  | `.husky/pre-commit`、`.husky/commit-msg` | 安装：`npm run prepare`                       |
| **lint-staged**  | 只对暂存区文件跑 lint/format    | `lint-staged.config.cjs`                 | 由 `pre-commit` 自动触发                      |
| **commitlint**   | 校验提交信息格式                | `commitlint.config.cjs`                  | 由 `commit-msg` 自动触发                      |
| **cz-git**       | 交互式生成规范提交              | `.czrc`                                  | `npm run commit`                              |
| **concurrently** | 并行启动前后端                  | `package.json` 的 `dev` 脚本             | `npm run dev`                                 |

**关键配置事实（供排查参考）**：

- ESLint：`prettier/prettier` 为 **error**；`@typescript-eslint/no-explicit-any` 前端 **warn**、后端 **off**；忽略 `admin/src/auto-imports.d.ts` 与 `admin/src/components.d.ts`。
- Prettier：`printWidth: 120`、`singleQuote: true`、`semi: true`、`trailingComma: 'all'`、`arrowParens: 'always'`、`endOfLine: 'lf'`。
- Stylelint：`stylelint-config-standard` + `stylelint-config-recess-order` + `stylelint-prettier`，放行 `@tailwind/@apply/@screen` 等 at-rule。
- lint-staged 分派：`*.{js,mjs,cjs,ts,vue}` → `eslint --fix` + `prettier --write`；`*.{json,css,scss,md,html,yml,yaml}` → `prettier --write`；`*.{css,scss,vue}` → `stylelint --fix --allow-empty-input`。
- husky：`pre-commit` = `npx lint-staged`；`commit-msg` = `npx --no -- commitlint --edit "$1"`。

---

## 9. 代码审查（CR）要点

| 维度 | 审查项                                                                               |
| ---- | ------------------------------------------------------------------------------------ |
| 分层 | Controller 是否只做参数解析/响应？Service 是否唯一操作 Model？Model 是否有业务逻辑？ |
| 类型 | 是否用了 `any`/`as any`？DTO 类型是否完整？                                          |
| 命名 | 是否符合第 2 节表格？是否见名知义？                                                  |
| 安全 | 密码是否哈希？响应是否经 DTO 脱敏？上传是否校验白名单？                              |
| 边界 | 空值/越界/重复是否处理？是否抛了明确的 `AppError`？                                  |
| 时区 | 是否直接对 DATETIME 字符串 `new Date()` 做比较？（见 4.6）                           |
| 查询 | `raw` 查询中 `col()` 是否写了真实列名？（见 4.5）                                    |
| 前端 | 是否 `<script setup lang="ts">`？请求错误是否依赖拦截器统一处理？                    |
| 注释 | 文件头/导出函数是否有注释？是否残留 TODO 无责任人？                                  |
| 规范 | 是否通过 `npm run lint` / `typecheck`？提交信息是否规范？                            |

---

## 附：相关文档

- 系统架构与统一约定：[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- Git 提交规范：[`docs/GIT-CONVENTION.md`](./GIT-CONVENTION.md)
- 产品需求：[`docs/PRD.md`](./PRD.md)
- 项目总览：[`../README.md`](../README.md)
