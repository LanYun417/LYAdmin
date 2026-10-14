<p align="center">
  <img src="admin/src/assets/logo.svg" alt="LYAdmin 蓝云后台管理系统" width="480">
</p>

<p align="center"><em>开箱即用的通用后台管理基座</em></p>

> 一套开箱即用的通用后台管理基座：JWT 双 Token 鉴权、RBAC + 数据权限、系统管理（用户 / 角色 / 菜单 / 部门 / 字典 / 参数）、三类日志、文件管理、代码生成器与 ECharts 仪表盘。前后端 TypeScript 全覆盖，遵循严格分层与统一工程规范。

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-42b883" alt="Vue" height="20">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6" alt="TypeScript" height="20">
  <img src="https://img.shields.io/badge/Vite-8-646cff" alt="Vite" height="20">
  <img src="https://img.shields.io/badge/Element%20Plus-2.14-409eff" alt="Element Plus" height="20">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-4.3-38bdf8" alt="Tailwind CSS" height="20">
  <img src="https://img.shields.io/badge/Express-5-000000" alt="Express" height="20">
  <img src="https://img.shields.io/badge/Sequelize-6-52b0e7" alt="Sequelize" height="20">
  <img src="https://img.shields.io/badge/MySQL-8-4479a1" alt="MySQL" height="20">
  <img src="https://img.shields.io/badge/node-%3E%3D24-339933" alt="Node" height="20">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" height="20">
</p>

## 目录

- [项目简介](#项目简介)
- [关于本项目](#关于本项目)
- [界面预览](#界面预览)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [默认账号](#默认账号)
- [可用脚本](#可用脚本)
- [环境变量](#环境变量)
- [部署](#部署)
- [接口约定](#接口约定)
- [贡献指南](#贡献指南)
- [常见问题](#常见问题)
- [许可](#许可)

---

## 项目简介

LYAdmin 面向企业内部运营 / 管理场景，提供一套可直接二次开发的中后台起点。它把「企业后台常见但每次都重复造」的能力沉淀为开箱可用的垂直切片：鉴权、权限、系统管理、日志、文件、代码生成、仪表盘。

设计取向：

- **前后端分离 + 严格分层**：后端 `routes → controllers → services → models`，`services` 是唯一操作数据模型的层；前端按 `views / api / store / components` 组织。
- **约定优先**：统一响应体、统一分页、统一错误码、菜单驱动动态路由、按钮级权限指令。
- **零魔法密钥**：JWT 密钥等敏感配置**无默认值**，缺失将拒绝启动，避免「默认口令」事故。
- **响应式优先**：窄屏（移动端）适配是默认要求，固定尺寸弹层一律走响应式封装。

## 关于本项目

本项目**完全由 AI 开发**：从需求梳理、系统设计、前后端编码到测试与文档，均在人工把关下由 AI 完成；仓库内的架构文档、代码规范与提交历史即这一过程的产物。

- 全程遵循统一的工程质量门禁（ESLint / Prettier / Stylelint / 类型检查 / 依赖基线守卫），提交前须全绿。
- 请以审阅 AI 生成代码的心态使用本仓库——欢迎通过 Issue / PR 指出问题与可改进之处。

## 界面预览

![首页仪表盘](./screenshot/dashboard.png)

| 菜单管理                                      | 操作日志                                    |
| --------------------------------------------- | ------------------------------------------- |
| ![菜单管理](./screenshot/menu-management.png) | ![操作日志](./screenshot/operation-log.png) |

| 代码生成                                     | 个人中心                              |
| -------------------------------------------- | ------------------------------------- |
| ![代码生成](./screenshot/code-generator.png) | ![个人中心](./screenshot/profile.png) |

## 功能特性

| 模块            | 能力                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 登录鉴权        | 账号密码登录、JWT 双 Token（access 2h / refresh 7d）、无感刷新、登出即时失效（Redis 黑名单）、登录频率限制、账号禁用强制下线                 |
| 权限管理        | RBAC 三段式（用户—角色—菜单）+ **数据权限**（数据范围：全部 / 自定义部门 / 本部门及以下 / 仅本人）；菜单树 → 动态路由；按钮级 `v-permission` |
| 用户管理        | 分页查询、增删改、启用 / 禁用、重置密码、分配角色、头像上传、部门归属                                                                        |
| 角色管理        | 角色 CRUD、菜单授权（权限树勾选）、数据范围设置、编码唯一校验                                                                                |
| 菜单管理        | 树形表格 CRUD、目录 / 菜单 / 按钮三类、图标选择、排序、显隐、路由与组件路径、权限标识                                                        |
| 部门管理        | 组织树 CRUD、上级部门选择、防成环校验、删除保护                                                                                              |
| 字典管理        | 字典类型 + 字典项两表；类型编码创建后不可改；内置字典保护；业务侧 `useDict` 缓存取数                                                         |
| 参数管理        | 单值可调的系统参数；键名创建后不可改；内置参数禁删                                                                                           |
| 日志管理        | 登录日志 / 操作日志 / HTTP 访问日志；条件筛选 + 导出；自动归档 + 按保留天数清理                                                              |
| 文件管理        | 多文件上传、哈希秒传预检、类型 / 大小白名单、列表多条件筛选、下载、删除、静态访问（防盗链 + 图片按需缩放）                                   |
| 代码生成        | 读取数据表结构 → 预览 → 生成前后端 CRUD 骨架（下载 ZIP 或写入项目目录）                                                                      |
| 仪表盘          | 统计卡片、近 7 日登录趋势、操作类型分布、各角色用户数（ECharts）                                                                             |
| 个人中心        | 修改资料、修改密码（旧密码校验）、更换头像                                                                                                   |
| Markdown 编辑器 | 内置 Vditor（懒加载、资源自托管、随主题切换亮 / 暗）                                                                                         |
| 布局与体验      | 侧边栏折叠、面包屑、标签页（tagsView）、keep-alive、暗黑模式、移动端响应式、403 / 404 / 500 错误页                                           |

## 技术栈

| 层             | 技术                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前端框架       | Vue 3.5 + Vue Router 5 + Pinia 4（`pinia-plugin-persistedstate`）                                                                                                |
| 前端 UI / 生态 | Element Plus 2.14 + Tailwind CSS 4.3 + `bootstrap-icons` + ECharts 6 + Vditor 4 + axios + dayjs + `@vueuse/core` + `lodash-es` + nprogress                       |
| 前端工程       | Vite 8 + TypeScript 5.9 + vue-tsc；`unplugin-auto-import` + `unplugin-vue-components` 按需引入；`vite-plugin-compression2` 构建期 gzip / brotli 压缩             |
| 后端框架       | Express 5 + TypeScript 5.9                                                                                                                                       |
| 后端数据层     | Sequelize 6 + `sequelize-typescript` + mysql2                                                                                                                    |
| 后端能力       | jsonwebtoken（JWT）+ bcryptjs（口令）+ zod（校验）+ multer（上传）+ sharp（图片处理）+ redis（官方 node-redis，黑名单 / 限流）+ cors + dotenv + reflect-metadata |
| 数据库 / 缓存  | MySQL 8.x（库 `ly_admin`，utf8mb4）；Redis（可选，缺失时相关增强自动降级）                                                                                       |
| 工程规范       | ESLint 10 + Prettier 3.9 + Stylelint 17 + husky 9 + lint-staged 17 + commitlint 21 + cz-git + concurrently                                                       |

> 代码规范由 ESLint / Prettier / Stylelint 统一约束，提交信息由 commitlint 校验，均由 husky 钩子在提交前自动拦截。

## 目录结构

```
ly-admin/
├─ admin/                     # 前端工程（Vue3 + Vite + Element Plus）
├─ api/                       # 后端工程（Express + TS + Sequelize）
│  ├─ web/                    # 前端构建产物映射目录（同源部署时由后端托管，产物不入库）
│  ├─ uploads/                # 上传文件目录（内容不入库）
│  └─ logs/                   # 日志文件目录
├─ .husky/                    # Git Hooks（pre-commit / commit-msg）
├─ scripts/                   # 根脚本（如依赖基线守卫 deps-guard.mjs）
├─ package.json               # 根脚本：lint / format / commit / dev（并行启动）
├─ eslint.config.mjs          # ESLint flat config（覆盖 admin + api）
├─ .prettierrc.json           # Prettier 规则
├─ .stylelintrc.json          # Stylelint 规则
├─ commitlint.config.cjs      # 约定式提交校验规则
├─ .czrc                      # cz-git 交互式提交配置
├─ lint-staged.config.cjs     # 暂存区分派 lint / format
├─ LICENSE                    # MIT
└─ README.md
```

**前端 `admin/src`**

```
admin/src/
├─ api/          # axios 实例(request.ts) + 各模块接口(auth/user/role/menu/dept/dict/config/log/file/gen/dashboard/profile)
├─ assets/       # 静态资源
├─ components/   # 通用组件：BasicDialog / ErrorPage / IconPicker / MenuTree / Pagination / SearchForm / VditorEditor
├─ directives/   # v-permission 按钮权限指令及注册
├─ composables/  # 组合式复用逻辑（useTable / useTheme / useResponsiveSize / useDict）
├─ layout/       # 主布局（AppMain / Navbar / Sidebar / TagsView）
├─ router/       # 路由实例 / 静态路由表 / 全局守卫
├─ store/        # Pinia（user / permission / app / tagsView）
├─ styles/       # index.css（Tailwind v4 入口 + @theme 令牌）/ element.scss（EP 覆盖）
├─ types/        # 全局类型 / 接口 DTO / 路由 meta
├─ utils/        # auth / format / permission / validate / element(命令式 API 桶) 等
├─ views/        # 页面：home / login / upload / system / log / profile / tool / error / redirect
├─ App.vue       # 根组件
└─ main.ts       # 入口：样式引入顺序、注册 Pinia/Router/指令
```

**后端 `api/src`**

```
api/src/
├─ config/       # index.ts（读取 .env）/ database.ts（Sequelize 实例 + sync）
├─ constants/    # 错误码 / 枚举 / 正则 / 上传白名单 / 分页默认值
├─ controllers/  # 控制器：参数解析 + 调 Service + 组装响应
├─ middlewares/  # auth / permission / validate / errorHandler / operationLog / upload / loginRateLimit / hotlinkGuard / imageScale
├─ models/       # Sequelize 模型 + 关联（User/Role/Menu/Dept/DictType/DictItem/SysConfig/File/三类日志/中间表等）
├─ routes/       # 业务路由 + index.ts 聚合（统一挂在 /api）
├─ seed/         # 种子数据：migrate → menu → role → user → dict → config
├─ services/     # 业务逻辑（唯一操作 Model 的层），含 dataScope / tokenBlacklist / authCache 等
├─ logging/      # 日志子系统：文件日志 / 批量缓冲 / 归档 / 保留清理 / 进程异常捕获
├─ docs/         # 自建接口文档（catalog + render）与路由/留痕覆盖校验
├─ types/        # 共享类型 + express.d.ts 扩展
├─ utils/        # response / jwt / password / pagination / tree / logger / userAgent 等
├─ validators/   # zod 校验 schema
├─ app.ts        # 创建 Express、挂载中间件 / 静态 / 路由 / 错误处理
└─ server.ts     # 入口：reflect-metadata → 连库 → sync → seed → listen
```

## 快速开始

### 环境要求

| 项      | 要求                                                     |
| ------- | -------------------------------------------------------- |
| Node.js | >= 24.0.0（验证于 v24.x）                                |
| npm     | >= 10                                                    |
| MySQL   | 8.x 运行中，需提前创建数据库 `ly_admin`（utf8mb4）       |
| Redis   | 可选。用于登出黑名单与登录限流；未配置时相关增强自动降级 |

### 1. 准备数据库

```sql
CREATE DATABASE IF NOT EXISTS `ly_admin`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
```

> 表结构由后端首次启动时 `sequelize.sync()` **自动创建**，无需手工建表；既有库的字段演进由种子里的幂等迁移自动补齐。

### 2. 安装依赖

根依赖（工程规范工具 + husky 钩子）**务必先装**：

```bash
npm install            # 根目录
cd api && npm install  # 后端
cd ../admin && npm install  # 前端
```

### 3. 配置环境变量

```bash
cd api
cp .env.example .env
```

至少需要改两处：

- `DB_*`：数据库连接信息。
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`：**必填且必须互不相同**，缺失或为空将拒绝启动。生成方式：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

完整变量清单见 [环境变量](#环境变量)。

### 4. 启动

```bash
# 根目录：并行启动前后端（api :3000，admin :5173）
npm run dev
```

或分别启动：

```bash
cd api && npm run dev      # http://localhost:3000
cd admin && npm run dev    # http://localhost:5173
```

启动后可访问：

- 前端页面：<http://localhost:5173>
- 接口文档：<http://localhost:3000/api-docs>（零依赖自建文档页）
- 健康检查：`GET http://localhost:3000/api`

> 前端 dev server 通过 Vite 代理把 `/api`、`/static` 转发到 `http://localhost:3000`，开发期同源、无跨域。

## 默认账号

| 账号    | 密码     | 角色                        |
| ------- | -------- | --------------------------- |
| `admin` | `123456` | 超级管理员（`super_admin`） |

首次启动会自动写入上述超管账号、默认角色与完整菜单树。

> **安全提示**：默认凭据仅用于本地初始登录。部署后请立即修改密码，并避免在公网环境使用默认口令。

## 可用脚本

### 根目录

| 命令                    | 说明                                           |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | 并行启动前后端                                 |
| `npm run dev:api`       | 仅启动后端                                     |
| `npm run dev:admin`     | 仅启动前端                                     |
| `npm run lint`          | 全仓 ESLint 检查（`--max-warnings 0`）         |
| `npm run lint:fix`      | 全仓 ESLint 自动修复                           |
| `npm run format`        | 全仓 Prettier 格式化                           |
| `npm run format:check`  | 全仓 Prettier 格式校验（不写文件）             |
| `npm run stylelint`     | 全仓 Stylelint 检查                            |
| `npm run stylelint:fix` | 全仓 Stylelint 自动修复                        |
| `npm run guard:deps`    | 校验三处 `package.json` 的运行时依赖与基线一致 |
| `npm run commit`        | cz-git 交互式生成规范提交                      |
| `npm run prepare`       | 装配 husky 钩子（`npm install` 后自动执行）    |

### 前端 `admin/`

| 命令                 | 说明                             |
| -------------------- | -------------------------------- |
| `npm run dev`        | Vite 开发服务（:5173）           |
| `npm run build`      | 类型检查 + 生产构建              |
| `npm run build:only` | 跳过类型检查，直接构建           |
| `npm run preview`    | 本地预览构建产物                 |
| `npm run type-check` | 仅类型检查（`vue-tsc --noEmit`） |

### 后端 `api/`

| 命令                   | 说明                                             |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | nodemon + ts-node 热重载                         |
| `npm run build`        | 编译到 `dist/`                                   |
| `npm run start`        | 运行编译产物 `dist/server.js`                    |
| `npm run seed`         | 单独执行种子数据（幂等）                         |
| `npm run check:models` | 模型关联冒烟（不连库校验关联声明，改模型后必跑） |
| `npm run typecheck`    | 仅类型检查（`tsc --noEmit`）                     |

## 环境变量

### 后端 `api/.env`

| 变量                           | 示例值                  | 说明                                                |
| ------------------------------ | ----------------------- | --------------------------------------------------- |
| `NODE_ENV`                     | `development`           | 运行环境                                            |
| `PORT`                         | `3000`                  | 后端端口                                            |
| `DB_HOST` / `DB_PORT`          | `localhost` / `3306`    | MySQL 主机 / 端口                                   |
| `DB_NAME` / `DB_USER`          | `ly_admin` / `root`     | 数据库名 / 账号                                     |
| `DB_PASSWORD`                  | `your_password`         | 数据库密码（改成实际值）                            |
| `DB_LOGGING`                   | `true`                  | 是否将 SQL 写入日志文件                             |
| `JWT_ACCESS_SECRET`            | `<32 字节随机 hex>`     | accessToken 密钥（**必填**，无默认值）              |
| `JWT_REFRESH_SECRET`           | `<32 字节随机 hex>`     | refreshToken 密钥（**必填**，须与上方不同）         |
| `JWT_ACCESS_EXPIRES_IN`        | `2h`                    | accessToken 有效期                                  |
| `JWT_REFRESH_EXPIRES_IN`       | `7d`                    | refreshToken 有效期                                 |
| `TRUST_PROXY`                  | `1`                     | 反向代理信任跳数（仅部署在代理后设置）              |
| `UPLOAD_DIR`                   | `uploads`               | 上传根目录（相对 `api/`）                           |
| `UPLOAD_MAX_SIZE`              | `10485760`              | 单文件上限（字节，10MB）                            |
| `UPLOAD_MAX_COUNT`             | `10`                    | 单次最多文件数                                      |
| `UPLOAD_CACHE_DIR`             | `cache/images`          | 图片缩放缓存目录（须位于 `UPLOAD_DIR` 之外）        |
| `UPLOAD_ALLOWED_REFERERS`      | `http://localhost:5173` | 防盗链 Referer 白名单（逗号分隔；同源部署无需配置） |
| `CORS_ORIGIN`                  | `http://localhost:5173` | 允许的跨域来源                                      |
| `LOG_DIR`                      | `logs`                  | 日志目录                                            |
| `LOG_ARCHIVE_HOUR/MINUTE`      | `0` / `5`               | 日志归档时刻（本地时间）                            |
| `LOG_ARCHIVE_KEEP_SOURCE`      | `false`                 | 归档后是否保留源 `.log`                             |
| `LOG_SLOW_SQL_MS`              | `200`                   | 慢 SQL 阈值（ms）                                   |
| `LOG_HTTP_RETENTION_DAYS`      | `7`                     | HTTP 访问日志保留天数                               |
| `LOG_OPERATION_RETENTION_DAYS` | `180`                   | 操作日志保留天数                                    |
| `LOG_LOGIN_RETENTION_DAYS`     | `180`                   | 登录日志保留天数                                    |
| `LOG_RETENTION_HOUR/MINUTE`    | `0` / `10`              | 保留清理触发时刻                                    |
| `LOG_RETENTION_ENABLED`        | `true`                  | 是否启用日志保留清理                                |
| `REDIS_HOST` / `REDIS_PORT`    | `127.0.0.1` / `6379`    | Redis 地址（留空 `REDIS_HOST` 即视为不启用）        |
| `REDIS_PASSWORD` / `REDIS_DB`  | 空 / `0`                | Redis 密码 / 库号                                   |

### 前端 `admin/.env.development` / `.env.production`

| 变量                   | 示例值             | 说明                              |
| ---------------------- | ------------------ | --------------------------------- |
| `VITE_APP_TITLE`       | `蓝云后台管理系统` | 站点标题                          |
| `VITE_API_BASE_URL`    | `/api`             | axios baseURL（走代理 / 同源）    |
| `VITE_UPLOAD_BASE_URL` | `/static`          | 静态资源前缀                      |
| `VITE_PORT`            | `5173`             | dev server 端口（仅 development） |

## 部署

### 方式一：同源部署（推荐）

前端产物直接构建进后端目录，由后端一并托管：

```bash
cd admin
npm run build:only -- --outDir ../api/web   # 产物输出到 api/web

cd ../api
npm run build
NODE_ENV=production node dist/server.js
```

- 后端启动时若 `api/web` 存在，会自动托管该目录，并对前端 history 路由做 `index.html` 回退。
- 产物目录可用 `WEB_DIST_DIR` 覆盖（相对 `api/`）。
- 同源部署下静态资源的防盗链「同源放行」天然成立，无需配置 `UPLOAD_ALLOWED_REFERERS`。

### 方式二：前后端分离部署

- 前端产物部署到任意静态服务器 / Nginx。
- 后端配置：`CORS_ORIGIN` 填前端地址；`UPLOAD_ALLOWED_REFERERS` 填前端 origin（否则 `/static` 静态资源会被判为外链 403）。
- 前端 `VITE_API_BASE_URL` 指向后端地址（或由网关统一前缀）。

> 生产环境建议将 `NODE_ENV=production`，并通过进程管理器（systemd / pm2 / 容器）托管；`UPLOAD_DIR`、`LOG_DIR`、`cache` 目录需保证可写与持久化。

## 接口约定

- **统一响应体**：成功 `{ "code": 200, "message": "success", "data": <T> }`；失败 `{ "code": <业务码>, "message": "<描述>", "data": null }`。
- **分页**：请求 `{ page, pageSize }`；响应 `data = { list, total, page, pageSize }`。
- **错误码**（节选）：`400` 参数校验失败 · `401` 未认证 / 账密错误 / 账号禁用 · `403` 无权限 · `404` 资源不存在 · `409` 数据冲突 · `500` 服务器错误。
- **鉴权**：除登录 / 刷新 / 接口文档外，均需在请求头携带 `Authorization: Bearer <accessToken>`。
- **静态资源**：`GET /static/:filename`（启用防盗链与图片按需缩放）。
- **在线文档**：启动后端后访问 `/api-docs`。

完整接口清单以运行期 `/api-docs` 为准。

## 贡献指南

欢迎提交 Issue 与 Pull Request。

1. **环境**：按[快速开始](#快速开始)拉起项目；根目录 `npm install` 以装配 husky 钩子。
2. **分支**：从 `master` 切出特性分支（命名 `feature/*` / `fix/*` / `hotfix/*`）。
3. **编码**：遵循 ESLint / Prettier / Stylelint 规范（见根目录工程配置）；提交信息使用 Conventional Commits（`npm run commit` 可交互生成）。
4. **提交前自检**（务必全绿）：

   ```bash
   npm run format:check      # Prettier
   npm run lint              # ESLint（--max-warnings 0）
   npm run stylelint         # Stylelint
   npm run guard:deps        # 依赖基线
   (cd api && npm run typecheck && npm run check:models)
   (cd admin && npm run type-check)
   ```

5. **PR**：说明背景与改动点，关联相关 Issue，并确保上述检查通过。

> 新增后端业务模块、菜单 / 权限、字段迁移等请遵循分层约定（routes → controllers → services → models，service 为唯一操作 Model 的层）。

## 常见问题

**Q1：端口被占用（3000 / 5173）？**
后端改 `api/.env` 的 `PORT`；前端改 `admin/.env.development` 的 `VITE_PORT`（`vite.config.ts` 为 `strictPort: true`，端口占用会直接报错而非自动切换）；同时同步 `vite.config.ts` 中 proxy 的 `target` 端口。

**Q2：启动即报 JWT 相关错误？**
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 为**必填**且需互不相同。按[第 3 步](#3-配置环境变量)生成随机值填入 `api/.env`。

**Q3：数据库连不上（`ECONNREFUSED` / `Access denied` / `Unknown database`）？**
确认 MySQL 已启动、`ly_admin` 库已创建；核对 `api/.env` 的 `DB_*`。库不存在时执行[第 1 步](#1-准备数据库)的建库 SQL。

**Q4：登录 / 鉴权正常，但登出黑名单、登录限流没生效？**
这两项依赖 Redis。未配置 `REDIS_HOST` 时视为不启用，主流程不受影响但增强失效。需要时启动 Redis 并配置 `REDIS_*`。

**Q5：Tailwind 样式不生效？**
本项目 Tailwind 采用 v4的 CSS 优先配置，**刻意不引入 preflight**（避免破坏 Element Plus），**不做全局重置**属预期行为。若工具类整体失效，检查 `admin/src/styles/index.css` 是否含 `@import url('tailwindcss/utilities.css')`、是否在 `main.ts` 末尾引入。改动 `@theme` 令牌后建议重启一次 dev server 确保产物刷新。

**Q6：提交时 husky 钩子不执行？**
在**根目录**执行 `npm install`（会触发 `prepare` → `husky`），确认 `.husky/` 下存在 `pre-commit` 与 `commit-msg`。只在 `admin/` 或 `api/` 装依赖不会装配钩子。

**Q7：登录成功但菜单为空？**
菜单由后端按当前用户角色下发。`super_admin` 仍为空说明种子未写入，执行 `cd api && npm run seed`（幂等）；普通角色请在「角色管理 → 菜单授权」中勾选。

**Q8：上传文件后访问 404？**
确认 `api/uploads/` 存在且可写；确保后端已启动、前端代理已转发 `/static`。分离部署时还需把前端 origin 配进 `UPLOAD_ALLOWED_REFERERS`。

**Q9：接口 401 且反复跳登录？**
accessToken 过期会由前端自动刷新（`admin/src/api/request.ts`）；refreshToken 也失效则登出。检查 `JWT_*` 配置一致性与服务器时间是否准确。

## 许可

本项目基于 [MIT 许可证](./LICENSE) 开源。
