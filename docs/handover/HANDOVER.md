# LYAdmin 接手文档（Handover）

> 交付日期：2026-09-24 ｜ 代码基线：`master @ eb5671a` ｜ 梳理方式：只读盘点（未改动任何源码）
> 本文件是**接手总入口**，三份分项报告见同目录（ARCHITECTURE / FEATURES / HEALTH）。

---

## 1. 一句话定位

**面向企业内部运营/管理场景的通用后台管理基座**——不是某个业务系统，而是"搭业务后台用的底座"：JWT 双 Token 鉴权、RBAC 菜单 + 按钮级权限、用户/角色/菜单管理、三类日志、文件上传、ECharts 仪表盘、代码生成器。

| 项         | 值                                                                      |
| ---------- | ----------------------------------------------------------------------- |
| 项目周期   | 2026-09-22 ~ 2026-09-24，共 **75 次提交**，单人开发（LanYun）           |
| 分支现状   | `master` 为主分支；`dev` 分支已落后 63 个提交，基本废弃（合流前需确认） |
| 代码规模   | 后端 85 个 TS / 10,709 行；前端 42 个 .vue + 35 个 .ts / 7,540 行       |
| CI         | **无**（无 .github，无流水线）                                          |
| 自动化测试 | **零覆盖**（0 个 test/spec 文件，3 个 package.json 均无 test 脚本）     |
| 许可       | MIT                                                                     |

---

## 2. 怎么把它跑起来

### 2.1 标准流程

```bash
# 1. 根目录（触发 husky 钩子装配，必须先装）
npm install
# 2. 后端
cd api && npm install && cp .env.example .env   # 改 DB_PASSWORD
cd ../admin && npm install
# 3. 起服务（根目录一键并行，或分别起）
npm run dev            # api :3000 + admin :5173
```

- 健康检查：`GET http://localhost:3000/api`
- 接口文档：`http://localhost:3000/api-docs`
- 默认账号：`admin / 123456`（超管 `super_admin`；另有 `admin`、`viewer` 两个预置角色）
- MySQL 需**手动建库** `ly_admin`，其余 9 张表启动时 `sequelize.sync()` 自动创建

### 2.2 五个必踩的坑（已实测）

| #   | 坑                                    | 说明                                                                                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **别用 `npm start`**                  | 后端生产启动 100% 崩 `Cannot find module '@/app'`，详见 §7 P0-1。**唯一可用方式是 `npm run dev`** |
| 2   | 端口 3000 常被占用                    | 换端口用 `PORT=3205 npm run dev`（dotenv 不覆盖已有环境变量）                                     |
| 3   | 换端口会跨域                          | 后端 CORS 白名单写死 `http://localhost:5173`，前端换端口需在 `.env` 同步 `CORS_ORIGIN`            |
| 4   | Windows 下 `tsc` / `vue-tsc` 可能 OOM | 本机 8GB 内存，需 `NODE_OPTIONS=--max-old-space-size=4096`                                        |
| 5   | Windows agent 起的服务杀不掉          | TaskStop / taskkill 常失效（权限拒绝、子进程存活）。验证改动务必用**全新空闲端口**起实例          |
| 6   | vite dev 在 Windows 可能解析到 IPv6   | `curl 127.0.0.1` 连不上时加 `--host 127.0.0.1`                                                    |

---

## 3. 系统全景

### 3.1 分层架构

```
┌────────────────────────────────────────────────────────────┐
│ 浏览器 Vue3 SPA (:5173)                                     │
│  views · components · directives(v-permission) · hooks      │
│  store(user/permission/app/tagsView) · router(动态注入)      │
└───────────────────────┬────────────────────────────────────┘
                        │ Vite proxy: /api · /uploads
┌───────────────────────▼────────────────────────────────────┐
│ Express 5 API (:3000)                                       │
│  中间件栈（顺序关键，见下）                                   │
│    → Router(9 模块) → Controller → Service → Model → MySQL   │
└────────────────────────────────────────────────────────────┘
```

**中间件顺序（`api/src/app.ts`，不可随意调换）**：
`cors` → `httpAccessLogger`(文件+DB 双写) → `morgan`(控制台) → `express.json/urlencoded` → `imageScaleMiddleware` → **`express.static('/uploads')`** → `operationLog` → 健康检查 → 业务路由 → `/api-docs` → `notFound` → `errorHandler`

> ⚠️ `imageScaleMiddleware` **必须**在 `express.static` 之前，否则 `?scale=` 缩放永远不生效（这个文件全 missing require，详见 §7）。
> 图片缩放命中时返回缩放结果，否则 `next()` 交 static 出原图。

### 3.2 前端最关键的机制：**菜单 100% 由后端驱动**

```
登录 → GET /api/auth/menus（菜单树 + permission 码数组）
     → guard.ts:51 注入 Layout 父路由
     → permission.ts:167 菜单树转路由对象 addRoute
     → Sidebar 渲染（filter status / visible）
     → 按钮级 v-permission 指令比对 store.user.permissions
```

这条链路决定了：**新功能必须在 `menu.seed.ts` 里注册，否则前端永远看不到**。详见 §8 改动路径。

### 3.3 数据模型（9 张表）

| 表                  | 用途          | 备注                                              |
| ------------------- | ------------- | ------------------------------------------------- |
| `sys_user`          | 用户          | 软删除式 status 禁用                              |
| `sys_role`          | 角色          | roleCode 唯一                                     |
| `sys_menu`          | 菜单/按钮     | 三段式：M(目录) C(菜单) F(按钮)，含 permission 码 |
| `sys_user_role`     | 用户↔角色     | 多对多                                            |
| `sys_role_menu`     | 角色↔菜单     | 多对多                                            |
| `sys_login_log`     | 登录日志      | **无清理机制、无索引**                            |
| `sys_operation_log` | 操作日志      | **无清理机制**                                    |
| `sys_http_log`      | HTTP 访问日志 | 只能全表 TRUNCATE，无按时间清理                   |
| `sys_file`          | 文件          | SHA-256 hash 去重 + filePath 引用计数             |

> ⚠️ 三张日志表**只增不减**，且其中两张零索引却支持按人/模块/时间筛选——数据量上来后必然成为性能瓶颈。

---

## 4. 模块地图

| 后端路由         | 控制器 / 服务                       | 前端页面                   | 前端 API     |
| ---------------- | ----------------------------------- | -------------------------- | ------------ |
| `/api/auth`      | auth                                | login                      | auth.ts      |
| `/api/users`     | user                                | system/user                | user.ts      |
| `/api/roles`     | role                                | system/role（权限抽屉）    | role.ts      |
| `/api/menus`     | menu                                | system/menu（树形表格）    | menu.ts      |
| `/api/logs`      | log                                 | log/{login,operation,http} | log.ts       |
| `/api/files`     | file                                | upload                     | file.ts      |
| `/api/dashboard` | dashboard                           | home（4 图表）             | dashboard.ts |
| `/api/profile`   | profile                             | profile                    | profile.ts   |
| `/api/gen`       | gen（+ gen.templates / gen.writer） | tool/gen                   | gen.ts       |
| `/api-docs`      | docs/{catalog,render,routeAudit}    | 无（服务端渲染页）         | 无           |

---

## 5. 权限模型 ★最重要★

### 5.1 项目硬性红线（前任踩过 P0 事故后立下的规矩）

事故背景：曾为"免改种子数据/重新登录"，把「清空 HTTP 日志」复用了只读权限码 `log:http:list`，导致**只读访客 viewer 能清空全量日志**。现已修复并固化为 5 条铁律：

1. **写操作 / 破坏性操作必须有独立权限码**，绝不可复用只读 `:list` / `:query`。
2. **只读角色 viewer 只能持有查看/查询类权限码**——任何 `add/edit/remove/delete/clear/export/reset/assign` 一律不得授予。
3. **后端 + 前端双保险**：接口 `requirePermission('<code>')`，前端按钮必须同时加 `v-permission="'<code>'"`。
4. **新增权限码的完整链路**（缺一不可）：
   `routes/*.ts` → `seed/menu.seed.ts`（BUTTON 级节点，findOrCreate 递归写入，启动即生效）→ `seed/role.seed.ts`（按需授予）→ 前端 `v-permission` → `docs/catalog.ts` 同步标注。
5. 后端中间件已改为 **fail-closed**（`requirePermission()` 不传参 = 拒绝）。超管直通（`permissions=["*"]`）。

### 5.2 当前合规性

**达标的部分**（三轮独立审查一致）：

- `requirePermission` **35 处调用零空参**，且已 fail-closed（`permission.ts:29`）
- 写操作未复用只读码：gen 四码分离、`log:http:clear` 独立、`user edit/resetPwd/assignRole` 独立
- `role.seed.ts` 中 viewer 的 9 个 key 全为查看/查询类，无写权限
- 历史越权事故未复发

**权限缺口已闭合**（原 5 处，详见 §7 P1-1 ~ P1-5，均已标记「已修复（2026-09-24）」）

---

## 6. 功能盘点结论

**81 个功能点**：已实现 69 ｜ 部分实现 9 ｜ 未实现 3
分布：认证鉴权 10 / 仪表盘 5 / 用户 9 / 角色 8 / 菜单 7 / 日志 8 / 文件 6 / 代码生成 6 / 个人中心 4 / 布局 10 / 错误页 4 / 运维 4

**PRD 39 条对照**（P0×17 / P1×17 / P2×5）：已交付 32 ｜ 部分交付 6 ｜ 未交付 1

超出 PRD 的新增能力（8 项，都是后来加的）：
代码生成 gen、图片按需缩放 `?scale=`、文件秒传（SHA-256）、自建接口文档 `/api-docs`、HTTP 日志落库+详情展开、移动端抽屉适配、日志按天归档、权限中间件 fail-closed + 超管通配

> ⚠️ **README「功能特性」表完全没写 gen / 图片缩放 / 秒传 / api-docs 这四项**，文档已滞后于代码。

---

## 7. 风险清单（三人交叉验证）

> 标记 **[共识]** 的条目表示架构、产品、QA 三条线独立审查得出一致结论，可信度最高。

### P0 — 阻塞级

| #        | 问题                            | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | **[共识] 后端生产启动完全失效** | `npm start`（`node dist/server.js`）启动即崩 `Cannot find module '@/app'`。根因：`tsconfig` 的 `paths: {"@/*": ["./src/*"]}` 只作用于**编译期**，tsc 不重写产物里的 `@/xxx`，dist 下 85 个 JS 全部保留 `require("@/app")` → Node 无法解析。<br>**整条生产部署链路 100% 不可用**；`npm run dev`（ts-node + tsconfig-paths）不受影响。<br>零依赖修复方案：**A)** 改 Node 官方 subpath imports（`#/*` + package.json `imports`）；**B)** src 全量改相对路径。注：tsc-alias / module-alias 属新增依赖，与项目零依赖约束冲突。 |
| **P0-2** | **[共识] 最高危操作无留痕**     | `DELETE /api/logs/http`（清空全量日志）与 `POST /api/gen/create`（向源码目录写文件）不在 `operationLog.ts:18` 的 `OPERATION_RULES` 里 → **零操作日志**。直接违反项目自定的「操作可追溯」目标 G3。<br>修复成本极低：往 `OPERATION_RULES` 数组加两条正则即可。                                                                                                                                                                                                                                                              |

### P1 — 权限与越权

| #        | 问题                                                                                                                                                                                                                                                                                                         | 位置                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **P1-1** | **[已修复（2026-09-24）] `GET /api/roles/all` 缺权限码**。已新增独立权限码 `system:role:all`（routes + menu.seed BUTTON 节点 + 授予超管/admin + docs/catalog 同步；viewer 不授予），未复用只读 `system:role:list`（避免收死分配角色下拉）。修复前：任意登录用户（含 viewer）可枚举全部角色含 `super_admin`。 | `api/src/routes/role.routes.ts:30`                                      |
| **P1-2** | **[已修复（2026-09-24）] 文件上传页整页 0 处 `v-permission`**。已补 2 处：拖拽上传区 `v-permission="'file:upload'"`、删除按钮 `v-permission="'file:remove'"`。                                                                                                                                               | `admin/src/views/upload/index.vue`                                      |
| **P1-3** | **[已修复（2026-09-24）] 用户状态开关未加权限控制**。已在 `@change` 回调内用 `hasPermission('system:user:edit')` 判定，无权限不发请求、开关回位并提示（开关在插槽内，用函数判断而非指令）。                                                                                                                  | `admin/src/views/system/user/index.vue:184`                             |
| **P1-4** | **[已修复（2026-09-24）] `/api/profile` 三接口定性为「用户自有资源豁免」**。经评审：操作的是用户**自己的**资料/密码/头像，任何登录用户修改自身账号属合理语义，**有意不补权限码**（补码会导致 viewer 连自己密码都改不了）；已在 `profile.routes.ts` 文件头与路由处加注释固化结论。                            | `api/src/routes/profile.routes.ts:17-19`                                |
| **P1-5** | **[已修复（2026-09-24）] 前端权限判定 fail-OPEN**。`utils/permission.ts` 空码/空数组改为返回 `false`，`directives/permission.ts` 同步移除空值早返回使空参即隐藏；已核查全站 18 处 `v-permission` 均传具体权限码，无空参调用。                                                                                | `admin/src/utils/permission.ts:10-12`、`directives/permission.ts:11-13` |

### P2

| #        | 问题                                                                                                                                                                         | 位置                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **P2-1** | **前端权限判定 fail-OPEN**（同 P1-5，前后端策略相反）                                                                                                                        | utils/permission.ts:10-12        |
| **P2-2** | **父菜单禁用后子按钮权限仍生效**——`collectPermissions` 只过滤 `Menu.status`，不校验父菜单状态                                                                                | `auth.service.ts:88-100`         |
| **P2-3** | **任何 403 都 `window.location.href='/403'` 整页跳转**，按钮级越权会打断用户、丢失已填表单。另：前端 guard 无 `meta.permission` 校验，手敲无权限 URL 落的是 **404 而非 403** | `request.ts:120-126/143-150`     |
| **P2-4** | **暗黑模式不持久化**——app store `persist.pick` 只有 `[sidebarCollapsed, primaryColor]`，漏了 dark 标志                                                                       | `admin/src/store/modules/app.ts` |
| **P2-5** | **零测试覆盖**——0 个 test/spec 文件。当前只能证明"能跑 + 类型/风格正确"，**无法证明业务行为正确**，重构无回归保护。这是最大长期风险。                                        | 全项目                           |

### P3

| #        | 问题                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------- |
| **P3-1** | JWT 默认密钥硬编码（`ly_admin_*_secret`），当前 `api/.env` **用的就是默认值** → 上线前必改           |
| **P3-2** | `/api-docs` 完全公开，暴露全量接口 + **全部权限码清单** → 生产环境应加鉴权或关开关                   |
| **P3-3** | 图片缩放缓存 `api/cache/images` **无淘汰机制**，源文件删了缓存还在 → 长期磁盘泄漏                    |
| **P3-4** | `sequelize.sync()` 每次启动自动建表 → 生产环境等于允许应用自动 DDL                                   |
| **P3-5** | 性能：每请求固定 2~3 次 SQL（`auth.service.ts:115-124` loadAuthUser 查 User+Role+Menu join，零缓存） |

### Top 5 技术债（架构视角）

1. `loadAuthUser` 每鉴权请求查库，零缓存 → 每请求 2~3 次 SQL
2. 三张日志表无清理归档能力；其中两张零索引却支持多条件筛选
3. 两套脱敏实现并存（`operationLog.ts:70-82` 精确匹配 vs `utils/logger.ts:35-47` 正则），规则不一致
4. 图片缓存无淘汰 + 生产环境自动 DDL
5. 403 整页跳转的粗暴处理

---

## 8. 工程健康度实测

**22 项检查：✅ 20 / ❌ 1 / ⚠️ 1**（全部通过除 P0-1）

| 检查项                           | 结果 | 数字                                                      |
| -------------------------------- | ---- | --------------------------------------------------------- |
| 后端 `tsc --noEmit`              | ✅   | 0 error（8s）                                             |
| 前端 `vue-tsc --noEmit`          | ✅   | 0 error（13s）                                            |
| ESLint `--max-warnings 0`        | ✅   | **0 error / 0 warning**                                   |
| Prettier `--check`               | ✅   | **0 个不合规文件**                                        |
| Stylelint                        | ✅   | **0 problem**                                             |
| 前端 `vite build`                | ✅   | 3.49s / 2497 modules / dist 3.8M                          |
| 后端 `tsc -p` 编译               | ✅   | 4s / dist 1.1M                                            |
| **后端 `npm start`**             | ❌   | **`Cannot find module '@/app'`**                          |
| 运行时冒烟（dev）                | ✅   | 健康检查 200、`/api-docs` 200、52 路由、鉴权正/负向均正确 |
| 文档覆盖自检                     | ✅   | **52 路由与 catalog 1:1，零告警**                         |
| husky / commitlint / lint-staged | ✅   | 链路实测有效                                              |

> 👍 一个正面结论：**零依赖接口文档覆盖率 100%**（运行时 52 条 = catalog 52 条）。仅 `catalog.ts:1771` 示例 JSON 里 `"total": 47` 是历史遗留静态文案。

非阻塞小问题：`.husky/commit-msg`/`pre-commit` 缺可执行位；`eslint.config.mjs` 的 ignores 路径写错（写成 `admin/src/auto-imports.d.ts`，实际在 `admin/`）；`.env` 比 `.env.example` 少 `DB_LOGGING`；`chunkSizeWarningLimit: 3000` 静默了 echarts 1,117KB 与 lib.esm 1,027KB 两个超大 chunk。

---

## 9. 新人上手：改一个典型功能要动哪些文件

以「新增一个业务模块」为例（两条路线）：

**路线 A — 用代码生成器 gen**（推荐，本项目自带）
`tool/gen` 页选表 → 预览 → **生成到项目**（自动落盘 `api/src` + `admin/src`，并自动接线 `models/index.ts` 与 `routes/index.ts`）→ 再补权限码与菜单种子。

**路线 B — 纯手工 17 步**
后端：model → validator(zod) → service → controller → routes → `routes/index.ts` 挂载 → `models/index.ts` 注册关联 → `menu.seed.ts` 加菜单 + 按钮节点 → `role.seed.ts` 授权 → `docs/catalog.ts` 补接口文档
前端：`api/xxx.ts` → `views/xxx/index.vue` → 类型定义 → 按钮加 `v-permission` → 如涉及写操作，`operationLog.ts` 的 `OPERATION_RULES` 加一条留痕规则

> ⚠️ **最容易漏的两步**：① `docs/catalog.ts` 不同步会被启动时的覆盖率校验告警；② 写操作不进 `OPERATION_RULES` 就永久失痕（P0-2 就是这么来的）。

---

## 10. 建议的下一步（按性价比）

| 优先级 | 动作                                                                                                    | 成本                            |
| ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1      | 给 `OPERATION_RULES` 加 `logs/http` 与 `gen` 两条（P0-2）                                               | 极低，改一个数组                |
| 2      | 补 P1 的 4 个权限缺口（roles/all 补码、upload 页 3 处指令、user 开关 1 处指令、profile 三接口明确策略） | 低                              |
| 3      | 前端权限判定改 fail-closed（P1-5）                                                                      | 低                              |
| 4      | 修 `npm start`（P0-1），打通生产部署链路                                                                | 中，建议走 Node subpath imports |
| 5      | 为 auth + permission + log 三条主线补最小回归测试（P2-5）                                               | 中，但这是能否安全重构的前提    |
| 6      | 上线前必改：JWT 默认密钥、`/api-docs` 加鉴权、禁生产自动 DDL                                            | 低~中                           |
| 7      | README 补上 gen / 图片缩放 / 秒传 / api-docs 四项                                                       | 极低                            |

---

## 11. 分项报告索引

| 文档                                                     | 内容                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE-HANDOVER.md`](./ARCHITECTURE-HANDOVER.md) | 814 行 / 4 张 Mermaid 图（分层架构、请求链路、RBAC 链路、9 表 ER）、9 表字段级说明、6 大关键机制、25 条技术债、上手路径 |
| [`FEATURES-HANDOVER.md`](./FEATURES-HANDOVER.md)         | 425 行 / 81 个功能点全清单、PRD 四象限对照、角色×权限矩阵、12 条体验问题                                                |
| [`HEALTH-HANDOVER.md`](./HEALTH-HANDOVER.md)             | 248 行 / 22 项检查实测数据与命令、阻塞与非阻塞问题、首次拉起清单                                                        |

---

## 12. 给接手者的提醒

1. **这个项目只有 3 天历史**，代码质量很高（lint/format/type 全零告警），但**工程化基建是空白**：无 CI、无测试、生产启动链路不通。
2. **权限是这个项目的第一优先级**（前任出过 P0 越权事故并立了铁律）。任何新功能先过 §5.1 的五条红线。
3. **代码有三处"零依赖自研"**（自建接口文档、自实现 ZIP、自实现 codegen），是为了满足"不引第三方包"的硬约束——**不要顺手换成第三方库**，会破坏约束。
4. `dev` 分支落后 63 个提交，基本废弃，改动基于 `master`。
