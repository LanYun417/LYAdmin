# LYAdmin 工程健康度验证报告

> 验证人：QA 工程师 严过关
> 验证时间：2026-09-24
> 验证环境：Windows / Git Bash / Node **v24.21.0** / npm **11.19.0** / MySQL **8.4.11**
> 仓库：`C:/Users/LY-VM/Desktop/ly-admin`，分支 `master`（HEAD `eb5671a`）
> 本次为**只读验证**，未改动任何源码；仅新增本报告文件。

---

## 1. 健康度总览

| #   | 检查项              | 命令                                                                    | 结果                | 关键数字                                                                                 |
| --- | ------------------- | ----------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| 1   | 依赖安装完整性      | `ls node_modules` ×3                                                    | ✅ 通过             | 根 275 / api 167 / admin 177 个包，三处 `node_modules` 均存在                            |
| 2   | 后端类型检查        | `cd api && npx tsc --noEmit`                                            | ✅ 通过             | **0 error**，`--max-warnings 0` 语义下亦 0 warning；耗时 8s                              |
| 3   | 前端类型检查        | `cd admin && npx vue-tsc --noEmit`                                      | ✅ 通过             | **0 error**；耗时 13s                                                                    |
| 4   | 全仓 ESLint         | `npx eslint . --max-warnings 0`                                         | ✅ 通过             | **0 error / 0 warning**；耗时 12s                                                        |
| 5   | Prettier 格式校验   | `npx prettier --check "**/*.{js,mjs,cjs,ts,vue,json,css,scss,md,html}"` | ✅ 通过             | **0 个不合规文件**（输出 `All matched files use Prettier code style!`）；耗时 9s         |
| 6   | Stylelint           | `npx stylelint "**/*.{css,scss,vue}"`                                   | ✅ 通过             | **0 problem**；耗时 7s                                                                   |
| 7   | 前端构建            | `cd admin && npx vite build`                                            | ✅ 通过             | **3.49s**（进程总 7s），2497 modules，`dist` **3.8 MB**；**0 warning**                   |
| 8   | 后端构建            | `cd api && npx tsc -p tsconfig.json`                                    | ✅ 通过（编译层面） | 4s，`dist` **1.1 MB**；**0 error**                                                       |
| 9   | 后端**生产启动**    | `cd api && npm start`（= `node dist/server.js`）                        | ❌ **失败（阻塞）** | `Error: Cannot find module '@/app'`，exit 1                                              |
| 10  | 后端**开发启动**    | `npx ts-node -r tsconfig-paths/register src/server.ts`（PORT=3205）     | ✅ 通过             | 启动 4s；DB 连接 / 建表 / 种子全部成功                                                   |
| 11  | 健康检查            | `GET /api`                                                              | ✅ 200              | `{"code":200,"message":"success","data":{"name":"ly-admin-api","status":"ok",...}}`，6ms |
| 12  | 接口文档页          | `GET /api-docs`                                                         | ✅ 200              | 217,252 bytes                                                                            |
| 13  | 接口文档数据        | `GET /api-docs/data.json`                                               | ✅ 200              | 108,777 bytes，**52 个路由**                                                             |
| 14  | 鉴权负向            | `POST /api/auth/login` 错误口令 / `GET /api/auth/profile` 无 token      | ✅ 401 / 401        | `账号或密码错误` / `未提供访问令牌`                                                      |
| 15  | 鉴权正向            | `POST /api/auth/login` admin/123456                                     | ✅ 200              | 返回 `accessToken` + `refreshToken`                                                      |
| 16  | 文档覆盖自检        | 启动日志 `[Docs] 接口文档覆盖校验`                                      | ✅ 通过             | 已文档化 **52** 个路由，**0 处不一致**                                                   |
| 17  | 前端 dev server     | `npx vite --port 3208 --host 127.0.0.1`                                 | ✅ 通过             | ready 1.5s；`GET /` 200（413B），`GET /src/main.ts` 200                                  |
| 18  | 原生/关键依赖可加载 | `require('sharp'\|'bcryptjs'\|'mysql2'\|'sequelize')`                   | ✅ 通过             | sharp（libvips 8.18.6）/ bcryptjs / mysql2 / sequelize 全部 OK                           |
| 19  | 单元测试            | 搜索 `*.test.ts` / `*.spec.ts` / vitest / jest 配置                     | ⚠️ **零测试**       | **0 个测试文件、0 个测试框架、0 个 test 脚本**                                           |
| 20  | husky 钩子          | `.husky/` + `git config core.hooksPath`                                 | ✅ 生效             | hooksPath=`.husky/_`；`.husky/_/*` 均为可执行位                                          |
| 21  | commitlint          | `echo "..." \| npx commitlint`                                          | ✅ 生效             | 合法信息 0 问题；`随便写的提交信息` → `type-empty` + `subject-empty` 2 个错误            |
| 22  | lint-staged         | 造一个格式错误文件 → `git add` → `npx lint-staged`                      | ✅ 生效             | `eslint --fix` + `prettier --write` 自动修复并回写暂存区                                 |

**汇总：22 项中 ✅ 20 项、❌ 1 项（阻塞）、⚠️ 1 项（高风险非阻塞）。**

---

## 2. 依赖与脚本盘点

### 2.1 根目录（`ly-admin`，工程规范根，不参与运行时）

| 脚本                          | 命令                                                                | 用途                                     |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `prepare`                     | `husky`                                                             | 安装 git hooks（npm install 后自动执行） |
| `lint`                        | `eslint . --max-warnings 0`                                         | 全仓 ESLint，warning 也当失败            |
| `lint:fix`                    | `eslint . --fix`                                                    | 自动修复                                 |
| `format`                      | `prettier --write "**/*.{js,mjs,cjs,ts,vue,json,css,scss,md,html}"` | 全量格式化                               |
| `format:check`                | `prettier --check ...`                                              | 格式校验（CI 用）                        |
| `stylelint` / `stylelint:fix` | `stylelint "**/*.{css,scss,vue}"`                                   | 样式检查 / 修复                          |
| `commit`                      | `cz`                                                                | cz-git 交互式约定式提交                  |
| `dev:api` / `dev:admin`       | `npm --prefix <子包> run dev`                                       | 单起一端                                 |
| `dev`                         | `concurrently -n api,admin ...`                                     | **同时起前后端**                         |

### 2.2 `api/`（Express 5 + TypeScript + Sequelize）

| 脚本        | 命令                                                                                                 | 本次验证                                       |
| ----------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `dev`       | `nodemon`（内部 `ts-node -r tsconfig-paths/register src/server.ts`，`TS_NODE_TRANSPILE_ONLY=false`） | ✅ 等价命令已验证可启动                        |
| `build`     | `tsc -p tsconfig.json`                                                                               | ✅ 编译成功，但产物**不可直接运行**（见 §3.1） |
| `start`     | `node dist/server.js`                                                                                | ❌ **失败**（见 §3.1）                         |
| `seed`      | `ts-node -r tsconfig-paths/register src/seed/index.ts`                                               | 未单独跑（启动时已自动执行，幂等）             |
| `typecheck` | `tsc --noEmit`                                                                                       | ✅ 0 error                                     |

### 2.3 `admin/`（Vue 3 + Vite + TypeScript）

| 脚本         | 命令                             | 本次验证                                              |
| ------------ | -------------------------------- | ----------------------------------------------------- |
| `dev`        | `vite --open`                    | ✅ 等价命令（`--host 127.0.0.1`）验证通过，ready 1.5s |
| `build`      | `vue-tsc --noEmit && vite build` | ✅ 两段均通过（本次分别执行：13s + 3.49s）            |
| `build:only` | `vite build`                     | ✅ 3.49s                                              |
| `preview`    | `vite preview`                   | 未验证（静态产物预览，风险低）                        |
| `type-check` | `vue-tsc --noEmit`               | ✅ 0 error                                            |

---

## 3. 阻塞级问题（会导致"跑不起来"）

### 3.1 【阻塞】后端生产启动脚本完全失效 —— `Cannot find module '@/app'`

**现象**

```bash
cd api && npm run build     # ✅ 成功，产出 dist/
cd api && npm start         # ❌ 立即崩溃
```

```
node:internal/modules/cjs/loader:1568
  throw err;
  ^
Error: Cannot find module '@/app'
Require stack:
- C:\Users\LY-VM\Desktop\ly-admin\api\dist\server.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)
    ...
    at Object.<anonymous> (C:\Users\LY-VM\Desktop\ly-admin\api\dist\server.js:8:15)
  code: 'MODULE_NOT_FOUND'
```

**根因**

- `api/tsconfig.json` 配置了路径别名：`"paths": { "@/*": ["./src/*"] }`。
- TypeScript 的 `paths` **只作用于编译期类型解析**，`tsc` **不会**把产物里的 `@/xxx` 重写成相对路径。
- 因此 `dist/**/*.js` 全部保留 `require("@/app")`、`require("@/config")` 等，**Node 运行时无法解析**。
- `npm run dev` 之所以正常，是因为 nodemon 走 `ts-node -r tsconfig-paths/register`，该 register 在运行时做了别名映射。

**影响面**：`dist/` 下 **85 个**编译产物 JS 文件全部受影响，**不是个别文件**，即 **整条生产部署链路 100% 不可用**。

**修复方案（按"零依赖约束"优先级排序）**

| 方案          | 做法                                                                                                                                                                  | 是否新增依赖            | 评价                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| **A（推荐）** | 改用 Node 官方 subpath imports：把 `@/*` 换成 `#/*`，在 `api/package.json` 加 `"imports": { "#/*": "./dist/*" }`，`tsconfig` 的 `paths` 同步改为 `"#/*": ["./src/*"]` | ❌ 零依赖               | 最干净，Node 20+ 原生支持，编译期+运行期统一                    |
| **B**         | `src/` 内全量改用相对路径导入                                                                                                                                         | ❌ 零依赖               | 最稳，但改动 85 个文件，量大                                    |
| C             | 构建后接 `tsc-alias` 重写别名                                                                                                                                         | ✅ 需新增 devDependency | 与"零依赖"约束冲突                                              |
| D             | 引入 `module-alias` + `_moduleAliases`，入口 require 一次                                                                                                             | ✅ 需新增 dependency    | 与"零依赖"约束冲突                                              |
| E             | `node -r tsconfig-paths/register dist/server.js`                                                                                                                      | 依赖现有 devDep         | 会把 `@/app` 解析到 `src/app.ts`，**Node 无法解析 .ts**，不可行 |

**当前可用绕过方式**（接手者立即可用）：

```bash
cd api && npm run dev      # ts-node + tsconfig-paths，已实测可用
# 或等价：
npx ts-node -r tsconfig-paths/register src/server.ts
```

---

## 4. 非阻塞问题（按风险从高到低）

### 4.1 【高风险】零测试覆盖

- 全仓 **0 个** `*.test.ts` / `*.spec.ts` / `*.test.js` / `*.spec.js`。
- 根 / `api` / `admin` 三个 `package.json` 中**没有任何测试脚本**，也无 `vitest.config.*` / `jest.config.*`，依赖里无 vitest / jest。
- 规模：后端 **85 个 .ts 文件 / 10,709 行**；前端 **42 个 .vue + 35 个 .ts / 7,540 行**。
- 风险：任何重构、升级或 bugfix **无回归保护**；本次验证只能证明"能跑起来 + 类型/风格正确"，**无法证明业务行为正确**。
- 建议：优先补 `api` 的 auth / 权限 / 日志三类核心路径测试（vitest + supertest 需新增依赖，需先确认是否突破"零依赖约束"）。

### 4.2 【中】`.husky/commit-msg` 与 `.husky/pre-commit` 缺可执行位

```
-rw-r--r--  .husky/commit-msg
-rw-r--r--  .husky/pre-commit
```

- **但规范链路实际有效**：Husky v9 把 `core.hooksPath` 指向 `.husky/_`，`.husky/_/h` 用 `sh -e "$s"` 直接 source 执行 `.husky/<hook>`，**不依赖可执行位**；`.husky/_/*` 均有 `-rwxr-xr-x`。
- 实测：commitlint 拦截非法提交信息 ✅、lint-staged 自动修复并回写 ✅。
- 建议：仍执行 `chmod +x .husky/commit-msg .husky/pre-commit`，避免换机器 / 换 husky 版本时踩坑。

### 4.3 【中】前端 dev server 默认 host 在 Windows 上可能解析到 IPv6

- 直接 `npx vite --port 3207`（默认 host `localhost`）时，`curl http://127.0.0.1:3207/` 返回 **HTTP 000（连不上）**，尽管 `netstat` 显示端口处于 LISTENING。
- 加 `--host 127.0.0.1` 后：`GET /` → **200**（413 B），`GET /src/main.ts` → **200**。
- 浏览器访问 `http://localhost:<port>` 不受影响；仅脚本化探测需注意。若用 curl 冒烟，请加 `-6` 走 `[::1]` 或显式 `--host 127.0.0.1`。

### 4.4 【低】ESLint ignores 路径与实际生成文件位置不匹配

`eslint.config.mjs` 中：

```js
ignores: [
  ...'admin/src/auto-imports.d.ts', // 实际在 admin/auto-imports.d.ts
  'admin/src/components.d.ts', // 实际在 admin/components.d.ts
];
```

- `.prettierignore` 写的是 `admin/auto-imports.d.ts`、`admin/components.d.ts`（**正确**）。
- 当前 ESLint 仍全绿（0 error），属**潜在隐患**：声明文件重新生成后可能被 lint 误报。

### 4.5 【低】`.env` 与 `.env.example` 差一个键

```
2a3
> DB_LOGGING
```

- `api/.env.example` 有 `DB_LOGGING`，`api/.env` 中该键被注释掉。代码默认 `true`（SQL 写入 `logs/db/`），行为无差异。

### 4.6 【低】`vite.config.ts` 把 chunk 告警阈值抬到 3000 kB

```ts
chunkSizeWarningLimit: 3000,
```

- 实际已产生两个超大 chunk：`echarts` **1,117 kB**（gzip 371 kB）、`lib.esm` **1,027 kB**（gzip 231 kB）。
- 因为阈值抬高，构建输出 **0 warning**，超大包问题被静默。首屏若同步加载 echarts 将明显变慢。

### 4.7 【低】Node 版本高于 README 声明

- README 声明"验证于 v22.x"，当前机器 **v24.21.0**；`engines` 要求 `>=20.19.0`。
- 实测 v24 下 ESLint 10 / Vite 8 / vue-tsc 3 / ts-node 全部通过，无兼容问题。

### 4.8 【环境提示】端口 3000 已被占用

- 本机 `0.0.0.0:3000` 已被 PID **3212** 占用（非本次验证启动的进程，未做任何操作）。
- 新拉起后端前需确认端口，否则 `EADDRINUSE`。
- 本次验证使用 **3205 / 3206 / 3207 / 3208**，**已全部释放**（验证后 `netstat` 复查无 LISTENING 残留）。

---

## 5. 结论：接手者第一次拉起项目要做什么

### 5.1 环境准备清单

| 步骤           | 命令                                      | 备注                                                                          |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| ① 确认 Node    | `node -v`                                 | 需 `>= 20.19.0`；实测 v24.21.0 可用                                           |
| ② 确认 MySQL   | 端口 3306 可达 + 库 `ly_admin` 存在       | 需 `utf8mb4`；表结构由 `sequelize.sync({alter:false})` 自动创建，无需手工建表 |
| ③ 装根依赖     | `npm install`                             | **必须先装**，会触发 `prepare` → `husky`，装配 git hooks                      |
| ④ 装后端依赖   | `cd api && npm install`                   |                                                                               |
| ⑤ 装前端依赖   | `cd ../admin && npm install`              |                                                                               |
| ⑥ 配置后端环境 | `cd api && cp .env.example .env` 后按需改 | 本机 `.env` 已存在且可用                                                      |
| ⑦ 起后端       | `cd api && npm run dev`                   | ⚠️ **不要**用 `npm start`（见 §3.1）                                          |
| ⑧ 起前端       | `cd admin && npm run dev`                 | 默认 5173；脚本 `vite --open` 会自动开浏览器                                  |
| ⑨ 或一键起两端 | 根目录 `npm run dev`                      | concurrently 并行                                                             |

### 5.2 默认账号与关键地址

| 项       | 值                                                                    |
| -------- | --------------------------------------------------------------------- |
| 超管账号 | `admin` / `123456`（种子数据，`api/src/seed/user.seed.ts`）           |
| 健康检查 | `http://localhost:3000/api`                                           |
| 接口文档 | `http://localhost:3000/api-docs` / `/api-docs/data.json`（52 个路由） |
| 前端     | `http://localhost:5173`                                               |
| 静态资源 | `http://localhost:3000/uploads`                                       |
| CORS     | `CORS_ORIGIN=http://localhost:5173`，改前端端口必须同步改             |

### 5.3 已知会撞到的坑（按踩坑概率排序）

1. **`npm start` 一定失败** —— 生产启动脚本因 `@/` 别名未重写而崩溃。**开发请用 `npm run dev`**；要上生产必须先修 §3.1。
2. **端口 3000 冲突** —— 本机常驻进程已占 3000。改端口：`PORT=3205 npm run dev`（dotenv 不覆盖已有环境变量）。
3. **前端起不来先看 5173** —— 后端 CORS 白名单写死 `http://localhost:5173`，前端换端口会导致跨域失败。
4. **不要 `npm install` 新包** —— 项目有"零依赖约束"（这是 §3.1 修复方案选型的第一约束，优先 A/B 方案）。
5. **Windows 上 curl 探测 dev server 连不上** —— 见 §4.3，加 `--host 127.0.0.1` 或用 `[::1]`。
6. **不要直接改 `package.json`** —— 本次验证未改动任何 `package.json`，接手者如需加依赖请先与架构确认。
7. **改代码后没有测试兜底** —— 见 §4.1，改完务必手工回归核心路径（登录 → 菜单 → 用户/角色 → 日志）。

### 5.4 一句话结论

> **"能跑起来，但只能以开发模式跑。"**
> 类型检查、ESLint、Prettier、Stylelint、前后端构建、DB 连接、健康检查、鉴权、接口文档**全部通过**，代码规范链路（husky / commitlint / lint-staged）**真实生效**；
> 唯一阻塞项是**后端生产启动脚本失效**（`@/` 别名问题，dist 产物不可运行）；
> 最大长期风险是**零测试覆盖**（18k 行代码无任何回归保护）。
