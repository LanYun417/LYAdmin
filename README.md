# 蓝云后台管理系统（LYAdmin）

> 一套面向企业内部运营/管理场景的**通用后台管理基座**：JWT 双 Token 鉴权、RBAC 菜单 + 按钮级权限、用户/角色/菜单管理、三类日志、文件上传、ECharts 仪表盘、个人中心与错误页。

![Vue](https://img.shields.io/badge/Vue-3.5-42b883) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Element Plus](https://img.shields.io/badge/Element%20Plus-2.14-409eff) ![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8) ![Express](https://img.shields.io/badge/Express-5-000000) ![Sequelize](https://img.shields.io/badge/Sequelize-6-52b0e7) ![MySQL](https://img.shields.io/badge/MySQL-8-4479a1) ![License](https://img.shields.io/badge/License-MIT-green)

---

## 1. 功能特性

| 模块       | 能力                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 登录鉴权   | 账号密码登录、JWT 双 Token（access 2h / refresh 7d）、无感刷新、登出、强制下线（状态校验） |
| 权限管理   | RBAC 三段式（用户—角色—菜单）、后端下发菜单树 → 前端动态路由、按钮级 `v-permission` 指令   |
| 用户管理   | 分页查询、增删改、启用/禁用、重置密码、分配角色、头像                                      |
| 角色管理   | 角色 CRUD、菜单授权（权限树勾选）、编码唯一校验                                            |
| 菜单管理   | 树形表格 CRUD、目录/菜单/按钮三类、图标选择、排序、显隐、路由/组件路径                     |
| 日志管理   | 登录日志、操作日志、HTTP 访问日志（列表 + 条件筛选 + 分页）                                |
| 文件上传   | 多文件上传（1~10）、类型/大小白名单、列表、删除、静态访问                                  |
| 仪表盘     | 统计卡片、近 7 日登录趋势、操作类型分布、各角色用户数（ECharts）                           |
| 个人中心   | 修改资料、修改密码（旧密码校验）、更换头像                                                 |
| 布局与体验 | 侧边栏折叠、面包屑、标签页（tagsView）、keep-alive、暗黑模式、403/404/500 错误页           |

---

## 2. 技术栈

| 层            | 技术                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 前端框架      | Vue ^3.5.43 + Vue Router ^5.3.1 + Pinia ^4.0.3（`pinia-plugin-persistedstate` ^4.7.1）                                                                                                     |
| 前端 UI       | Element Plus ^2.14.6 + `@element-plus/icons-vue` ^2.3.2 + Tailwind CSS ^3.4.19                                                                                                             |
| 前端工具      | Vite ^8.3.0 + TypeScript ^5.9.3 + vue-tsc ^3.3.11 + axios ^1.20.0 + ECharts ^6.1.0 + dayjs ^1.11.23 + `@vueuse/core` ^15.0.0 + `lodash-es` ^4.18.1 + nprogress ^0.2.0 + sortablejs ^1.15.7 |
| 前端按需引入  | `unplugin-auto-import` ^21.1.0 + `unplugin-vue-components` ^32.1.0                                                                                                                         |
| 后端框架      | Express ^5.2.1 + TypeScript ^5.9.3                                                                                                                                                         |
| 后端数据层    | Sequelize ^6.37.8 + `sequelize-typescript` ^2.1.6 + mysql2 ^3.24.4                                                                                                                         |
| 后端安全/工具 | jsonwebtoken ^9.0.3 + bcryptjs ^3.0.3 + zod ^4.6.5 + multer ^2.4.0 + morgan ^1.12.1 + cors ^2.8.6 + dotenv ^18.0.2 + dayjs ^1.11.23 + reflect-metadata ^0.2.2                              |
| 后端开发工具  | ts-node ^10.9.2 + nodemon ^3.1.14 + tsconfig-paths ^4.2.0                                                                                                                                  |
| 数据库        | MySQL 8.x（库 `ly_admin`，utf8mb4）                                                                                                                                                        |
| 工程规范      | ESLint ^10.11.0 + Prettier ^3.9.8 + Stylelint ^17.15.0 + husky ^9.1.7 + lint-staged ^17.5.1 + commitlint ^21.2.3 + cz-git ^1.14.0                                                          |

---

## 3. 整体目录结构

### 3.1 根目录（统一工程规范）

```
ly-admin/
├─ admin/                     # 前端工程（Vue3 + Vite + Element Plus）
├─ api/                       # 后端工程（Express + TS + Sequelize）
├─ docs/                      # 项目文档（PRD / 架构 / 代码规范 / 提交规范）
├─ .husky/                    # Git Hooks（pre-commit / commit-msg）
├─ package.json               # 根脚本：lint / format / commit / dev（并行启动）
├─ eslint.config.mjs          # ESLint flat config（覆盖 admin + api）
├─ .prettierrc.json           # Prettier 规则（printWidth 120、单引号、分号）
├─ .prettierignore            # Prettier 忽略清单
├─ .stylelintrc.json          # Stylelint 规则（standard + recess-order + prettier）
├─ .stylelintignore           # Stylelint 忽略清单
├─ .editorconfig              # 编辑器统一：UTF-8 / LF / 2 空格缩进
├─ commitlint.config.cjs      # 约定式提交校验规则
├─ .czrc                      # cz-git 交互式提交配置
├─ lint-staged.config.cjs     # 暂存区文件分派 lint / format
├─ .npmrc                     # 固定 registry 为 npmmirror
├─ .gitignore                 # 忽略 node_modules / dist / .env / uploads 内容
└─ README.md                  # 本文件
```

### 3.2 前端 `admin/src`（展开到二级）

```
admin/
├─ src/
│  ├─ api/                    # axios 实例(request.ts) + 各模块接口(auth/user/role/menu/log/file/dashboard/profile)
│  ├─ assets/                 # 静态资源（logo 等）
│  ├─ components/             # 通用组件：IconPicker / MenuTree / Pagination / SearchForm
│  ├─ directives/             # v-permission 按钮权限指令及注册
│  ├─ hooks/                  # 组合式复用逻辑（useTable / useTheme）
│  ├─ layout/                 # 主布局
│  │  ├─ components/          # AppMain / Navbar / Sidebar / TagsView
│  │  └─ index.vue
│  ├─ router/                 # 路由实例 / 静态路由表 / 全局守卫
│  ├─ store/                  # Pinia
│  │  └─ modules/             # user / permission / app / tagsView
│  ├─ styles/                 # index.css（Tailwind 入口）/ element.scss（EP 覆盖）
│  ├─ types/                  # 全局类型 / 接口 DTO / 路由 meta
│  ├─ utils/                  # auth / format / permission / validate
│  ├─ views/                  # 页面：dashboard / login / upload / system / log / profile / error / redirect
│  ├─ App.vue                 # 根组件
│  ├─ main.ts                 # 入口：样式引入顺序、注册 Pinia/Router/指令/图标
│  ├─ vite-env.d.ts           # Vite 环境与 .vue 模块类型声明
│  ├─ auto-imports.d.ts       # 自动导入类型（生成物，纳入版本管理）
│  └─ components.d.ts         # 自动注册组件类型（生成物，纳入版本管理）
├─ index.html
├─ vite.config.ts             # 别名 @→src、端口 5173、proxy、自动导入
├─ tailwind.config.js         # preflight:false、darkMode:'class'
├─ postcss.config.js
├─ tsconfig.json / tsconfig.node.json
└─ .env.development / .env.production
```

### 3.3 后端 `api/src`（展开到二级）

```
api/
├─ src/
│  ├─ config/                 # index.ts（读取 .env）/ database.ts（Sequelize 实例 + sync）
│  ├─ constants/              # 错误码 / 枚举 / 正则 / 上传白名单 / 分页默认值
│  ├─ controllers/            # 8 个控制器：参数解析 + 调 Service + 组装响应
│  ├─ middlewares/            # auth / permission / validate / errorHandler / operationLog / upload
│  ├─ models/                 # 8 张表模型 + 关联（User/Role/Menu/UserRole/RoleMenu/LoginLog/OperationLog/File）
│  ├─ routes/                 # 8 个业务路由 + index.ts 聚合
│  ├─ seed/                   # 种子数据：menu → role → user
│  ├─ services/               # 8 个服务：业务逻辑（唯一操作 Model 的层）
│  ├─ types/                  # 共享类型 + express.d.ts 扩展
│  ├─ utils/                  # response / jwt / password / pagination / tree / logger / asyncHandler
│  ├─ validators/             # zod 校验 schema
│  ├─ app.ts                  # 创建 Express、挂载中间件/静态/路由/错误处理
│  └─ server.ts               # 入口：reflect-metadata → 连库 → sync → seed → listen
├─ uploads/                   # 上传文件目录（内容不入库）
├─ logs/                      # 日志文件目录
├─ nodemon.json               # 热重载配置（ts-node 直跑）
├─ tsconfig.json              # commonjs + 装饰器元数据 + 路径别名 @/*
├─ .env / .env.example        # 环境变量
└─ package.json
```

---

## 4. 快速开始

### 4.1 环境要求

| 项      | 要求                                               |
| ------- | -------------------------------------------------- |
| Node.js | >= 20.19.0（本项目验证于 v22.x）                   |
| npm     | >= 10                                              |
| MySQL   | 8.x 运行中，需提前创建数据库 `ly_admin`（utf8mb4） |

### 4.2 准备数据库

```sql
CREATE DATABASE IF NOT EXISTS `ly_admin`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
```

> 表结构由后端首次启动时 `sequelize.sync()` **自动创建**（8 张表），无需手工建表。

### 4.3 安装依赖

```bash
# 根目录（工程规范工具，务必先装，用于装配 husky 钩子）
npm install

# 后端
cd api && npm install

# 前端
cd ../admin && npm install
```

### 4.4 配置并启动后端

```bash
cd api
cp .env.example .env      # 复制模板后按需修改
npm run dev               # 启动于 http://localhost:3000
```

- 首次启动会自动建表并写入种子数据（超管账号、默认角色、完整菜单树）。
- 健康检查：`GET http://localhost:3000/api`。

### 4.5 启动前端

```bash
cd admin
npm run dev               # 启动于 http://localhost:5173
```

访问 `http://localhost:5173`，使用默认账号登录。

### 4.6 根目录一键并行启动

```bash
npm run dev               # concurrently 同时启动 api(:3000) 与 admin(:5173)
```

> 前端 dev server 通过 Vite 代理将 `/api`、`/uploads` 转发到 `http://localhost:3000`，同源无跨域。

---

## 5. 默认账号

| 账号    | 密码     | 角色                        |
| ------- | -------- | --------------------------- |
| `admin` | `123456` | 超级管理员（`super_admin`） |

> ⚠️ **安全提示**：`admin` / `123456` 仅用于本地初始登录，**首次部署后请立即修改密码**（个人中心 → 修改密码），并避免在公网环境使用默认凭据。

---

## 6. 可用脚本

### 6.1 根目录（`package.json`）

| 命令                    | 说明                                            |
| ----------------------- | ----------------------------------------------- |
| `npm run prepare`       | 装配 husky Git 钩子（`npm install` 后自动执行） |
| `npm run lint`          | 全仓 ESLint 检查（`eslint . --max-warnings 0`） |
| `npm run lint:fix`      | 全仓 ESLint 自动修复                            |
| `npm run format`        | 全仓 Prettier 格式化                            |
| `npm run format:check`  | 全仓 Prettier 格式校验（不写文件）              |
| `npm run stylelint`     | 全仓 Stylelint 检查                             |
| `npm run stylelint:fix` | 全仓 Stylelint 自动修复                         |
| `npm run commit`        | cz-git 交互式生成规范提交                       |
| `npm run dev:api`       | 仅启动后端                                      |
| `npm run dev:admin`     | 仅启动前端                                      |
| `npm run dev`           | 并行启动前后端                                  |

### 6.2 前端 `admin/`

| 命令                 | 说明                                     |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Vite 开发服务（:5173）                   |
| `npm run build`      | 类型检查（`vue-tsc --noEmit`）+ 生产构建 |
| `npm run build:only` | 跳过类型检查，直接构建                   |
| `npm run preview`    | 预览构建产物                             |
| `npm run type-check` | 仅类型检查                               |

### 6.3 后端 `api/`

| 命令                | 说明                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | nodemon + ts-node 热重载开发  |
| `npm run build`     | 编译到 `dist/`（tsc）         |
| `npm run start`     | 运行编译产物 `dist/server.js` |
| `npm run seed`      | 单独执行种子数据（幂等）      |
| `npm run typecheck` | 仅类型检查（`tsc --noEmit`）  |

---

## 7. 环境变量说明

### 7.1 后端 `api/.env`

| 变量                     | 示例值                    | 说明                         |
| ------------------------ | ------------------------- | ---------------------------- |
| `NODE_ENV`               | `development`             | 运行环境                     |
| `PORT`                   | `3000`                    | 后端端口                     |
| `DB_HOST`                | `localhost`               | MySQL 主机                   |
| `DB_PORT`                | `3306`                    | MySQL 端口                   |
| `DB_NAME`                | `ly_admin`                | 数据库名                     |
| `DB_USER`                | `root`                    | 数据库账号                   |
| `DB_PASSWORD`            | `your_password`           | 数据库密码（**改成实际值**） |
| `DB_LOGGING`             | `false`                   | 是否打印 SQL                 |
| `JWT_ACCESS_SECRET`      | `ly_admin_access_secret`  | accessToken 密钥             |
| `JWT_REFRESH_SECRET`     | `ly_admin_refresh_secret` | refreshToken 密钥            |
| `JWT_ACCESS_EXPIRES_IN`  | `2h`                      | accessToken 有效期           |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                      | refreshToken 有效期          |
| `UPLOAD_DIR`             | `uploads`                 | 上传根目录（相对 `api/`）    |
| `UPLOAD_MAX_SIZE`        | `10485760`                | 单文件上限（字节，10MB）     |
| `UPLOAD_MAX_COUNT`       | `10`                      | 单次最多文件数               |
| `CORS_ORIGIN`            | `http://localhost:5173`   | 允许的跨域来源               |
| `LOG_DIR`                | `logs`                    | 日志文件目录                 |

### 7.2 前端 `admin/.env.development`

| 变量                   | 示例值             | 说明                          |
| ---------------------- | ------------------ | ----------------------------- |
| `VITE_APP_TITLE`       | `蓝云后台管理系统` | 站点标题                      |
| `VITE_API_BASE_URL`    | `/api`             | axios baseURL（走 Vite 代理） |
| `VITE_UPLOAD_BASE_URL` | `/uploads`         | 静态资源前缀                  |
| `VITE_PORT`            | `5173`             | dev server 端口               |

### 7.3 前端 `admin/.env.production`

| 变量                   | 示例值             | 说明         |
| ---------------------- | ------------------ | ------------ |
| `VITE_APP_TITLE`       | `蓝云后台管理系统` | 站点标题     |
| `VITE_API_BASE_URL`    | `/api`             | 生产同源前缀 |
| `VITE_UPLOAD_BASE_URL` | `/uploads`         | 静态资源前缀 |

---

## 8. 接口约定速览

- **统一响应体**：成功 `{ "code": 200, "message": "success", "data": <T> }`；失败 `{ "code": <业务码>, "message": "<描述>", "data": null }`。
- **分页**：请求 `{ page, pageSize }`；响应 `data = { list, total, page, pageSize }`。
- **错误码**（节选）：`400` 参数校验失败 · `401` 未认证/账密错误/账号禁用 · `403` 无权限 · `404` 资源不存在 · `409` 数据冲突 · `500` 服务器错误。
- **静态资源**：`GET /uploads/:filename`。
- 完整接口清单见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) 第 5 节；响应体与错误码细则见第 6 节。

---

## 9. 文档索引

| 文档          | 路径                                                           | 用途                                   |
| ------------- | -------------------------------------------------------------- | -------------------------------------- |
| 产品需求文档  | [`docs/PRD.md`](./docs/PRD.md)                                 | 需求范围、优先级、验收标准             |
| 系统架构设计  | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)               | 技术选型、数据模型、接口清单、统一约定 |
| 代码规范      | [`docs/CODE-STYLE.md`](./docs/CODE-STYLE.md)                   | 命名、前后端编码约定、注释、工具链     |
| Git 提交规范  | [`docs/GIT-CONVENTION.md`](./docs/GIT-CONVENTION.md)           | 分支策略、提交信息、钩子与排查         |
| 类图 / 时序图 | `docs/class-diagram.mermaid` · `docs/sequence-diagram.mermaid` | 结构与关键流程可视化                   |

---

## 10. 常见问题 FAQ

**Q1：端口被占用（3000 或 5173）怎么办？**
后端改 `api/.env` 的 `PORT`；前端改 `admin/.env.development` 的 `VITE_PORT`（`vite.config.ts` 为 `strictPort: true`，端口被占用会直接报错而非自动切换）。同时记得同步 `vite.config.ts` 中 proxy 的 `target` 端口与后端一致。

**Q2：数据库连不上（`ECONNREFUSED` / `Access denied`）？**
确认 MySQL 已启动、`ly_admin` 库已创建；核对 `api/.env` 的 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`。若报 `Unknown database 'ly_admin'`，执行第 4.2 节的建库 SQL。

**Q3：Tailwind 样式不生效？**
本项目 Tailwind 设了 `corePlugins.preflight: false`（避免破坏 Element Plus），因此 Tailwind **不做全局重置**属预期行为。若工具类整体失效，检查：`admin/src/styles/index.css` 是否含 `@tailwind base/components/utilities`；该文件是否在 `main.ts` 中最后引入；`tailwind.config.js` 的 `content` 是否覆盖到对应 `.vue`。

**Q4：提交时 husky 钩子未安装 / 不执行？**
在**根目录**执行 `npm install`（会自动触发 `prepare` → `husky`），确认 `.husky/` 下存在 `pre-commit` 与 `commit-msg`。只在 `admin/` 或 `api/` 装依赖不会装配钩子。

**Q5：登录成功后菜单为空？**
菜单由后端按当前用户角色下发。若 `super_admin` 登录仍为空，说明种子数据未写入——执行 `cd api && npm run seed` 重跑种子（幂等）；若为普通角色，检查是否已在「角色管理 → 菜单授权」中勾选菜单。

**Q6：接口报 401 且反复跳登录页？**
accessToken 过期时前端会自动刷新（`admin/src/api/request.ts` 无感刷新）；若 refreshToken 也失效则登出。检查 `api/.env` 的 `JWT_*` 配置是否与登录时一致、系统时间是否准确。

**Q7：上传文件后访问 404？**
确认 `api/uploads/` 目录存在且可写；静态目录挂载在 `/uploads`，前端使用 `VITE_UPLOAD_BASE_URL` 前缀拼接；确保后端已启动且前端代理已转发 `/uploads`。

---

## 许可

MIT
