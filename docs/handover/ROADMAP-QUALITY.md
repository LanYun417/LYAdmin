# LYAdmin 质量保障与工程基建路线图（ROADMAP-QUALITY）

> 作者：QA 工程师 严过关 ｜ 日期：2026-09-24 ｜ 基线：`master @ eb5671a`
> 性质：**只读方案设计**。未改动任何源码或已有文档，未执行任何 `npm install`。
> 本文所有"实测"数据均来自本机（Windows / Git Bash / Node **v24.21.0** / npm 11.19.0 / MySQL 8.4.11）当场跑出的结果，复现命令见 §10。

---

## 0. 结论先行（30 秒决策版）

| 决策项          | 结论                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **测试框架**    | **推荐选项 C：后端 `node:test`（Node 原生，`node --test`）+ 已有 `ts-node`/`tsconfig-paths`**，**零新增依赖、零配置包**；前端 Phase 3 再引入 vitest                               |
| 一句话理由      | 实测 23 个用例（单测 / 中间件 / DB 集成 / 真实 HTTP 集成 / 代码生成产物编译）**全绿、3.4 秒跑完、覆盖率报告与阈值门禁开箱可用**，且**全程零新增依赖**——"零依赖约束"连讨论都不需要 |
| 最先该测的 Top5 | ① 权限判定 ② `operationLog` 留痕 ③ JWT 双 Token 刷新 ④ 架构守卫（权限码全覆盖 + 写操作必留痕）⑤ 菜单树构建                                                                        |
| 质量门禁        | 阶梯式：**S0 不设覆盖率门槛、只卡"用例全绿 + 覆盖率不下降"** → S1 核心目录 60% → S2 45%/75% → S3 60%/85%                                                                          |
| CI 选型         | **先做平台无关的 `scripts/ci.sh` + 分层测试**，托管 CI 用 Gitee Go（仓库实际托管在 Gitee，非 GitHub）                                                                             |
| 最大意外发现    | 仓库 remote 是 **gitee.com/lanyun417/ly-admin.git**，不是 GitHub —— §5 的 CI 选型必须按这个事实来                                                                                 |

---

## 1. 现状基线（量化）

| 指标                       | 数值                                                                                                            | 来源                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 后端规模                   | 85 个 `.ts` / 10,709 行                                                                                         | HEALTH §4.1                          |
| 前端规模                   | 42 个 `.vue` + 35 个 `.ts` / 7,540 行                                                                           | HEALTH §4.1                          |
| 测试文件                   | **0**                                                                                                           | HEALTH 检查项 19                     |
| 测试脚本                   | 3 个 `package.json` 中 **0 个**                                                                                 | HEALTH 检查项 19                     |
| 工程健康度                 | 22 项：✅20 / ❌1 / ⚠️1                                                                                         | HEALTH §1                            |
| 生产启动                   | ❌ `Cannot find module '@/app'`（P0-1）                                                                         | HEALTH §3.1                          |
| 路由总数                   | 49 条注册（52 条文档口径含 docs 路由）                                                                          | 本次实测 grep                        |
| 写操作路由                 | 25 条（其中 `/api/auth/*` 3 条按设计不进操作日志 → **应纳入留痕的 22 条**）                                     | 本次实测 grep                        |
| `requirePermission` 调用点 | **35 处，全部带参，0 处空参**                                                                                   | 本次实测复核（与 ARCHITECTURE 一致） |
| 操作日志规则覆盖           | `OPERATION_RULES` 14 条规则 → 覆盖 22 条写路由中的 **18 条**，**缺 4 条**（`gen` ×3 + `logs/http` ×1，即 P0-2） | 本次实测比对                         |
| 权限缺口                   | P1-1 ~ P1-5 共 **8 处**（roles/all 无码、upload 页 0 指令、user 开关、profile 三接口、前端 fail-open…）         | HANDOVER §7                          |

**基线判断**：这个项目"类型/风格/规范"三道防线是齐的（tsc、vue-tsc、eslint、prettier、stylelint 全零告警），**唯独缺"行为正确性"这一道**。所以基建的第一目标不是覆盖率数字，而是**把历史上真实发生过的两类事故（越权、失痕）钉死在测试里**。

---

## 2. 测试框架选型对比

### 2.1 先厘清一件事："零依赖约束"到底约束什么

项目对「接口文档 / ZIP / 代码生成」三块的零依赖要求，其**真实目的**是：不污染 `dependencies`、不污染生产部署产物、不引入不可控的第三方运行时行为。

按这个目的重新审视测试框架：

| 维度                                     | 是否触碰约束                                                 |
| ---------------------------------------- | ------------------------------------------------------------ |
| `dependencies`（生产运行时依赖）         | **完全不触碰** —— 测试框架即使引入，也只进 `devDependencies` |
| 生产部署产物（`api/dist`、`admin/dist`） | **不触碰** —— 测试目录不参与 `tsc` 构建（见 §2.4 目录约定）  |
| 运行时行为污染                           | **不触碰** —— 测试进程与 `src/` 运行时完全隔离               |
| `package.json` 观感                      | 会多 1~2 行 devDependencies（**这是唯一代价**）              |

**结论**：如果引入 vitest，破坏的是"package.json 观感"而非"生产安全"。**但选项 C 连这点代价都不需要付**——`node:test` 是 Node 标准库的一部分，和 `node:fs` 一个性质，**它根本不是一个"包"**。因此：

> 在 Phase 1~2（后端），**不需要为测试破任何例**。把"是否为测试框架开 devDependency 例外"这个决策**推迟到 Phase 3（是否测前端）**再讨论，届时再权衡。

### 2.2 A / B / C 三选项对比

| 对比项                     | **A：自研极简运行器（零依赖）**                                                    | **B：vitest + jsdom（devDep）**                                                 | **C：node:test（Node 原生，零依赖）**                                                          |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 覆盖范围                   | 只能测纯函数；HTTP/DB 集成需自己造轮子（顺带把断言、并发、超时、报告全部重写）     | 单测 + 组件 +（加 supertest 后）HTTP 集成，前后端通吃                           | 单测 + 中间件 + DB 集成 + **真实 HTTP 集成**（实测可行）+ 代码生成产物编译，**前端组件测不了** |
| 引入成本                   | 中：需自己写 ~200~400 行运行器（发现、并发、异步、报告），且这 400 行本身无测试    | 中高：2 个包（vitest + jsdom，前端还要 @vue/test-utils）+ 配置文件 + alias 打通 | **极低：0 个包**。装的东西一个都没有，只加 npm scripts                                         |
| 维护成本                   | **高**：自研运行器的坑（并发隔离、异步泄漏、信号、退出码）要自己扛，且无人社区支持 | 低：社区成熟                                                                    | **极低**：Node 官方维护，随 Node 升级                                                          |
| 覆盖率                     | 无（自研几乎做不出可靠的 V8 覆盖率映射）                                           | 需 `@vitest/coverage-v8`（第 3 个包）                                           | **内置**：`--experimental-test-coverage`，实测输出 line/branch/funcs 三列 + 未覆盖行号         |
| 覆盖率阈值门禁             | 无                                                                                 | 配置文件里 `thresholds`                                                         | **内置**：`--test-coverage-lines/branches/functions`，实测不合格时 **exit code = 1**           |
| 与现有 lint/type 流程整合  | 差：自研运行器自身要过 eslint/prettier，还要写 d.ts                                | 中：需 `vitest.config.ts` 与 `vite.config.ts` 别名同步                          | **好**：`ts-node` + `tsconfig-paths` 已是现有 devDep，`@/` 别名直接可用（实测通过）            |
| CI 友好度                  | 差（无标准报告）                                                                   | 好（junit 需插件）                                                              | **好**：内置 `--test-reporter=junit`（实测产出标准 JUnit XML，可直接贴 CI）                    |
| Windows 兼容性             | 自研需自己处理路径/分隔符/退出码                                                   | 好（但需验证与 Vite 8 的兼容，见下）                                            | **实测通过**：Git Bash 与 **cmd.exe 两种形态**均验证（详见 §10 探针 8/9）                      |
| 与 P0-1（`@/` 别名）的关系 | 无关                                                                               | 无关                                                                            | **轻微耦合**：见 §9.1                                                                          |
| 新增依赖数                 | 0                                                                                  | 2~3（vitest / jsdom / @vue/test-utils）                                         | **0**                                                                                          |

> vitest 兼容性已核实（未安装，仅查询 registry）：`vitest@5.0.1` 的 peerDeps 为 `vite: ^6.4.0 || ^7.0.0 || ^8.0.0`，本项目 `admin` 装的是 **vite 8.3.0 → 兼容**；engines `node: ^22.12.0 || ^24.0.0 || >=26.0.0`，本机 **v24.21.0 → 兼容**；`jsdom@30.1.1` engines `^22.22.2 || ^24.15.0 || >=26.0.0 → 兼容**。**即：选项 B 在技术上没有障碍，障碍只是"要不要破例"。**

### 2.3 推荐：**C（主方案）+ B（Phase 3 前端补充）**

**推荐 C 的五条理由（按权重排序）**

1. **零代价绕过争议**：`node:test` 不是包。在"零依赖约束"这个项目第一硬约束面前，任何需要开会讨论的方案都不如一个不需要讨论的方案。
2. **能力已实测足够**：本项目的核心风险面（权限、JWT、日志留痕、菜单树、文件去重、代码生成）**全部落在后端**，而后端 100% 可被 `node:test` 覆盖（探针 1~7 已逐个证明，含真实 HTTP 请求与真实 MySQL 查询）。
3. **性能**：探针全量 23 用例 **3.4 秒**；单个测试文件 0.5~3.0 秒。适合放进 pre-push。
4. **开箱即用的门禁能力**：覆盖率报告 + 阈值门禁 + JUnit 报告，全是内置 flag，CI 不需要任何插件。
5. **与现有栈零摩擦**：`ts-node` / `tsconfig-paths` 已在 `api/package.json` 的 devDependencies 里，`nodemon.json` 里甚至已经写了一行 `ignore: ["src/**/*.spec.ts"]`——**前任作者早就预留了测试的位置**，选项 C 是顺着他的设计走。

**为什么不推荐 A**：自研运行器唯一的优势是"零依赖"，而 C 同样零依赖却更强。A 的唯一产出是一坨需要自己维护、且本身没有测试的代码——**净负债**。

**为什么 B 不是首选**：它解决的问题（前端组件/指令测试）在风险排序里排不进前 5（前端当前最该修的是 8 个权限缺口，那是**修 bug**不是**加测试**）。等 Phase 3 前端权限指令补齐后，再用 vitest 锁住它们，性价比才成立。

### 2.4 落地步骤（可直接照抄）

#### 步骤 1：目录约定（关键决策）

```
api/
  src/            ← 运行时源码，不动
  tests/          ← 【新增】测试根目录，与 src 平级
    unit/         ← 无 DB、无网络的纯单测（CI 必跑）
    integration/  ← 需要 DB / HTTP 的集成测试
    helpers/      ← 夹具工厂、DB 启停、登录助手
```

**为什么放 `api/tests/` 而不是 `api/src/**/*.test.ts`**：`api/tsconfig.json` 的 `include` 是 `["src/**/*.ts"]`、`rootDir` 是 `./src`。若测试放 `src/` 内，`npm run build`（`tsc -p`）会把测试文件一起编译进 `dist/`，**污染生产产物、并把 P0-1 的影响面从 85 个文件扩大到更多**。放 `tests/` 则天然隔离（已实测：`node --test` + ts-node 对 `src/` 外的文件同样生效，别名照常解析）。

> 补充：`nodemon.json` 里已有 `ignore: ["src/**/*.spec.ts"]`，说明作者预期过 in-src 测试；但从构建隔离角度仍建议放 `tests/`。

#### 步骤 2：`api/package.json` 加 3 个脚本（**零新增依赖**）

```jsonc
{
  "scripts": {
    // 既有的 dev/build/start/seed/typecheck 保持不动
    "test": "node --require tsconfig-paths/register --require ts-node/register/transpile-only --test \"tests/**/*.test.ts\"",
    "test:unit": "node --require tsconfig-paths/register --require ts-node/register/transpile-only --test \"tests/unit/**/*.test.ts\"",
    "test:db": "node --require tsconfig-paths/register --require ts-node/register/transpile-only --test \"tests/integration/**/*.test.ts\"",
    "test:cov": "node --require tsconfig-paths/register --require ts-node/register/transpile-only --test --experimental-test-coverage --test-coverage-exclude=\"tests/**\" --test-coverage-exclude=\"src/server.ts\" --test-coverage-exclude=\"src/seed/**\" --test-coverage-exclude=\"src/docs/**\" \"tests/**/*.test.ts\"",
    "typecheck:test": "tsc -p tsconfig.test.json",
  },
}
```

**这四条命令已在本机实测通过**（包括 **cmd.exe 形态**，即 Windows 下 `npm run` 的真实执行环境）：

- `--require tsconfig-paths/register`：让 `@/` 别名在**运行期**生效（与 `npm run dev` 用的是同一套机制）。
- `--require ts-node/register/transpile-only`：`transpile-only` 变体**替代了 `TS_NODE_TRANSPILE_ONLY=true` 环境变量**，从而**不依赖 shell 语法**，Windows `cmd.exe` 下也不会挂。
- 用 **CLI `--require` 而非 `NODE_OPTIONS`**：已验证 `--require` 会被 `node --test` 传递给子进程；且 CLI 参数不含 `VAR=value` 前缀，**跨平台安全**（这是 Windows 上最容易踩的坑）。
- 实测：装饰器等语法在 `transpile-only` 下正常工作（`sys_file` 等 9 个模型的 `@Table/@Column` 全部可用，探针 5 验证）。

#### 步骤 3：新增 `api/tsconfig.test.json`（让测试文件也进类型检查）

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"],
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
}
```

> 若不建这个文件，`npm run typecheck`（`include: src/**` 只覆盖 src）**不会检查测试文件**，测试里的类型错误就漏了。这是必须补的一环。

#### 步骤 4：`admin/` 暂不动（Phase 3 再动）

若 Phase 3 决定测前端，在 `admin/` 加：

```bash
cd admin && npm i -D vitest jsdom @vue/test-utils    # 3 个 devDep，不动 dependencies
```

```ts
// admin/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
```

#### 步骤 5：与 husky / lint-staged 的冲突分析（**结论：无冲突**）

| 现有机制                                                               | 是否冲突               | 说明                                                                                                             |
| ---------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lint-staged.config.js` 的 `*.{js,mjs,cjs,ts,vue}` → eslint + prettier | **不冲突，且自动生效** | 新增的 `tests/**/*.ts` 落在该 glob 内，会被自动 lint 与格式化，无需改配置                                        |
| `*.{json,css,scss,md,html,yml,yaml}` → prettier                        | 不冲突                 | —                                                                                                                |
| `commitlint`                                                           | 不冲突                 | —                                                                                                                |
| `prepare: husky`                                                       | 不冲突                 | —                                                                                                                |
| **`.husky/_/pre-push` shim**                                           | **已存在**             | 实测 `.husky/_/` 下 `pre-push*` 文件已生成（Husky v9 预置），**新增 `.husky/pre-push` 即可生效，无需重装 husky** |
| `.gitignore`                                                           | **已就绪**             | 已含 `coverage/`、`*.log`、`dist/`，覆盖率产物默认不会误提交                                                     |
| eslint 的 `import/no-extraneous-dependencies`                          | **不冲突**             | 选项 C 不引入任何包；若将来走选项 B，`admin` 的 eslint 需确认该规则对 devDep 的配置                              |
| `tsc -p tsconfig.json` 构建                                            | **不冲突**             | 测试在 `tests/`，不在 `include` 内                                                                               |

---

### 2.5 实测证据矩阵（本报告的信任基础）

| #   | 探针                                           | 命令要点                                  | 结果                                   |
| --- | ---------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| 1   | 纯函数单测（`buildTree`）                      | `node --test` + ts-node                   | ✅ 4/4，**0.55s**                      |
| 2   | 内置覆盖率报告                                 | `--experimental-test-coverage`            | ✅ 输出 line/branch/funcs + 未覆盖行号 |
| 3   | 权限中间件（`requirePermission`）              | 真实导入 `@/middlewares/permission`       | ✅ 5/5，**0.59s**                      |
| 4   | JWT 双 Token                                   | 真实导入 `@/utils/jwt`                    | ✅ 6/6，**0.72s**                      |
| 5   | DB 集成（真实 MySQL `ly_admin`，只读）         | `@/config/database` + 9 个装饰模型        | ✅ 4/4，**1.24s**                      |
| 6   | 真实 HTTP 集成（`createApp()` + 原生 `fetch`） | `app.listen(0)` 随机端口                  | ✅ 4/4，**3.0s**（优化后）             |
| 7   | 代码生成产物可编译性                           | `previewGenCode()` → 落盘 → `tsc`         | ✅ **0 error**                         |
| 8   | 目录级自动发现                                 | `--test "tests/**/*.test.ts"`             | ✅ 23/23，**3.4s**                     |
| 9   | Windows `cmd.exe` 形态                         | `.bat` 模拟 npm script                    | ✅ 1/1（glob 与引号均正确）            |
| 10  | 覆盖率阈值门禁                                 | `--test-coverage-lines=100`（故意不可达） | ✅ **exit code = 1**（门禁有效）       |
| 11  | JUnit 报告                                     | `--test-reporter=junit`                   | ✅ 产出标准 XML                        |

**实测覆盖率基线**（探针纳入 9 个文件：6 个 middleware + `tree.ts` + `auth.service.ts`）：

```
file              | line % | branch % | funcs %
permission.ts     | 100.00 |   100.00 |  100.00
tree.ts           |  91.57 |    89.47 |   90.00
errorHandler.ts   |  60.32 |    66.67 |   66.67
upload.ts         |  60.00 |    50.00 |   20.00
operationLog.ts   |  44.53 |    66.67 |   37.50
validate.ts       |  38.24 |   100.00 |   25.00
imageScale.ts     |  38.14 |    60.00 |   50.00
auth.service.ts   |  26.67 |   100.00 |   10.00
auth.ts           |  22.22 |    50.00 |  100.00
all files         |  45.69 |    79.66 |   47.92
```

---

## 3. 测试优先级清单（核心产出）

**排序模型**：`风险分 = 出问题代价(1~5) × 出问题概率(1~5)`。概率的判定依据：①历史上是否真出过；②改动频率；③是否跨模块/跨端；④是否有"静默失败"特征（错了也不报错）。

### 3.1 Tier-0：立刻写（风险分 ≥ 15，全是"静默失败 + 已发生过"型）

| 待测目标                                                                | 类型             | 为什么先测它                                                                                                                             | 关键用例（3~5 条具体断言）                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 涉及文件                                                                                                                                               |
| ----------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **① 权限判定 `requirePermission`**<br>代价5×概率4=**20**                | 单测             | **历史上出过 P0 越权事故**（viewer 用只读码清空全量日志）。这是项目第一红线，任何回归都不能突破                                          | 1. 空码 `requirePermission()` → `next(err)` 且 `err.httpStatus === 403`（fail-closed）<br>2. 无 `req.user` → `401`<br>3. `roles:['super_admin']` + 任意码 → **放行**（超管直通）<br>4. `viewer` 持 `system:user:list` 访问 `system:user:remove` → `403`<br>5. 多码 `('a','b')` 持 `b` → 放行（命中任一即过）                                                                                                                                                                    | `api/src/middlewares/permission.ts`                                                                                                                    |
| **② `operationLog` 留痕规则**<br>代价4×概率5=**20**                     | 单测 + 集成      | **P0-2 就是这么来的**：写操作漏配规则 → 永久失痕，且不报任何错。实测 22 条写路由中 **4 条无留痕**（`gen`×3 + `logs/http`×1）             | 1. `POST /api/users` → 落库 `module='用户管理', action='新增'`<br>2. `PUT /api/users/1/status` → `action='启用禁用'`，`PUT /api/users/1` → `action='编辑'`，`DELETE /api/users/1` → `action='删除'`<br>3. `GET /api/users` → **不落库**（非写方法直接 return null）<br>4. `/api/auth/*` → **不落库**（EXCLUDED_PREFIXES）<br>5. 请求体含 `password` → `params` 中该字段值为 `'***'`（脱敏）<br>6. 失败响应（4xx）→ `result=0` 且 `errorMessage` 非空                            | `api/src/middlewares/operationLog.ts`<br>`api/src/services/log.service.ts`<br>`api/src/constants/index.ts`（SENSITIVE_KEYS）                           |
| **③ JWT 双 Token 签发/刷新**<br>代价4×概率4=**16**                      | 单测 + 集成      | 双 Token 是最容易"改一处崩一片"的链路；且 access/refresh 密钥不同，一旦被互相串用就是安全洞                                              | 1. `signAccessToken` → `verifyAccessToken` 解开且 `userId/username` 正确<br>2. **`verifyAccessToken(refreshToken)` 抛 `invalid signature`**（密钥隔离）<br>3. **`verifyRefreshToken(accessToken)` 抛 `invalid signature`**<br>4. 篡改签名第三段 → 校验失败<br>5. 过期 token → `TokenExpiredError`，经 `authenticate` 转 `401 '登录已过期，请重新登录'`<br>6. `POST /api/auth/refresh` 用合法 refreshToken → 返回**新的一对** token，且新 accessToken 可访问 `/api/auth/profile` | `api/src/utils/jwt.ts`<br>`api/src/middlewares/auth.ts`<br>`api/src/services/auth.service.ts`（`refresh`）<br>`api/src/controllers/auth.controller.ts` |
| **④ 架构守卫：权限码全覆盖**（防 P1-1/P1-4 复发）<br>代价5×概率3=**15** | 单测（静态扫描） | 一次写死，**永久防住"新增接口忘了加权限码"**。这是投入产出比最高的一类测试                                                               | 1. 扫描 `routes/*.routes.ts`，断言**每条非 `auth`/`dashboard` 路由的中间件链里都含 `requirePermission`**<br>2. 断言 `requirePermission()` **空参调用数 === 0**（当前实测 35 处全带参）<br>3. 断言**所有写操作路由的权限码不含 `:list`/`:query`/`:all` 只读后缀**（写操作必须有独立码）<br>4. 快照：权限码全集变化时**要求显式更新快照**（迫使人工确认）<br>5. 断言 `role.seed.ts` 中 `viewer` 持有码**不含** `add/edit/remove/delete/clear/export/reset/assign` 任一关键字      | `api/src/routes/*.routes.ts`<br>`api/src/seed/role.seed.ts`<br>`api/src/seed/menu.seed.ts`                                                             |
| **⑤ 菜单树构建 `buildTree` + 下发**<br>代价4×概率3=**12**               | 单测 + 集成      | 前端菜单 **100% 由后端驱动**（`GET /api/auth/menus`），树构建错一层，整个后台就穿了；且 `buildTree` 是纯函数，**测试成本极低、收益极高** | 1. 乱序输入 → 同层按 `sort` 升序、`sort` 相同按 `id` 升序<br>2. **父节点缺失**（脏数据）→ 降级为根节点，不丢节点<br>3. 深层级（≥3 层）结构正确，`children` 非空<br>4. `getMenusByRoles(['super_admin'],[])` → 返回**全部** M/C 节点；普通角色 → 仅其角色授权节点<br>5. `menuType==='F'`（按钮）**不出现在** `getMenusByRoles` 结果中<br>6. 禁用菜单（`status=0`）不出现在下发树中                                                                                               | `api/src/utils/tree.ts`<br>`api/src/services/menu.service.ts`<br>`api/src/services/auth.service.ts`                                                    |

> **Tier-0 补充（风险分 15，强烈建议同批做）**
> **⑥ 登录主链路冒烟（集成/E2E）**：`POST /api/auth/login`(admin/123456) → 200 且返回 `accessToken`/`refreshToken` → 带 token `GET /api/auth/profile` → `roles` 含 `super_admin`、`permissions` 含 `'*'` → `GET /api/auth/menus` 非空树 → `POST /api/auth/refresh` → 新 token 可用 → `POST /api/auth/logout` → 200。
> 涉及：`api/src/controllers/auth.controller.ts`、`api/src/services/auth.service.ts`、`api/src/routes/auth.routes.ts`
> 反例必须覆盖：错误口令 → 401 `账号或密码错误`；**禁用账号 → 401 `账号已被禁用`**（这条是"绕过鉴权"最常见的漏网口）；无 token → 401 `未提供访问令牌`。

### 3.2 Tier-1：第二轮（风险分 9~12）

| 待测目标                                                    | 类型             | 为什么先测它                                                                                                             | 关键用例                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 涉及文件                                                                                                                               |
| ----------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **⑦ 文件秒传去重**<br>代价3×概率3=**9**                     | 集成             | SHA-256 去重 + 引用计数是**有状态**逻辑，错了就是"文件被误删"或"磁盘泄漏"，且难复现                                      | 1. 首次上传 → `File` 表新增 1 条，`deduplicated` 未设置<br>2. **再次上传相同内容 → 记录数仍为 1**，响应带 `deduplicated: true`，且**本次临时物理文件已被 `fs.rmSync` 清理**<br>3. `GET /api/files/check?hash=<sha256>` 命中 → 返回最早一条记录<br>4. 删除最后一条引用 → **磁盘文件被删除**<br>5. 【边界·建议明确】A 上传、B 秒传（不新增记录）→ B 删除 → **A 的记录仍在但物理文件已删**（当前实现的"引用计数"实际不会因秒传 +1）。**这条断言用于固化现状并暴露风险**，需产品确认是否为期望行为 | `api/src/services/file.service.ts`<br>`api/src/controllers/file.controller.ts`<br>`admin/src/utils/hash.ts`（前端哈希，需与后端一致）  |
| **⑧ 代码生成模板产物可编译性**<br>代价3×概率4=**12**        | 集成（编译断言） | 生成器是"写源代码的源代码"，产物一旦不可编译，**每次生成的都是垃圾**，且反馈链路很长。实测当前产物 **0 error**，正好锁住 | 1. `previewGenCode({tableName:'sys_file',moduleName:'probe',businessName:'probeItem'})` → **产出 8 个文件**（5 后端 + 1 前端 api + 1 vue + README）<br>2. 5 个后端文件落盘到临时目录 + 临时 tsconfig → **`tsc --noEmit` 0 error**（本次实测通过）<br>3. 产物含 `toPascal/toCamel/toTsType` 正确映射：`sys_file` → `ProbeItem`、`bigint` → `number`<br>4. 非法 `moduleName`（含 `/` 或数字开头）→ `400`（路径穿越防护）<br>5. `buildGenZip()` 产出非空 Buffer 且 ZIP 头为 `PK\x03\x04`          | `api/src/services/gen.service.ts`<br>`api/src/services/gen.templates.ts`<br>`api/src/services/gen.writer.ts`<br>`api/src/utils/zip.ts` |
| **⑨ 前端权限判定 `hasPermission`**<br>代价4×概率3=**12**    | 单测（Phase 3）  | 前端 **fail-OPEN**（空码放行），与后端 fail-closed 相反（P1-5/P2-1）。修之前先写测试锁定行为                             | 1. `permissions=['*']` → 任意码 true<br>2. `permissions=['system:user:add']` + 查 `system:user:add` → true<br>3. 查未持有码 → **false**<br>4. **空码 `''` / `undefined` / `[]` → 当前返回 true（fail-open，这是缺陷）**，修复后应断言为 false<br>5. `hasRole` 同套断言                                                                                                                                                                                                                         | `admin/src/utils/permission.ts`<br>`admin/src/directives/permission.ts`                                                                |
| **⑩ 菜单 CRUD 约束（成环/删除/父子）**<br>代价2×概率2=**4** | 集成             | 树结构的破坏性边界：把父级设成自己的后代会形成环，导致菜单永久消失                                                       | 1. `updateMenu(id,{parentId:id})` → `400 上级菜单不能为自身`<br>2. `updateMenu(parent,{parentId:descendantId})` → `400 上级菜单不能为自身子级`<br>3. `createMenu({parentId: 不存在的id})` → `400 上级菜单不存在`<br>4. `deleteMenu(有子菜单的id)` → `409 存在子菜单`<br>5. 删除菜单 → `sys_role_menu` 关联行同步清理                                                                                                                                                                           | `api/src/services/menu.service.ts`                                                                                                     |

### 3.3 Tier-2：有余力再补

| 待测目标                                              | 类型            | 关键用例摘要                                                                                                                                                | 涉及文件                                                           |
| ----------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ⑪ 分页/查询工具 `parsePagination` + `buildPageResult` | 单测            | page<1 归一、pageSize 上限、`total/pages` 计算正确                                                                                                          | `api/src/utils/pagination.ts`                                      |
| ⑫ 密码哈希 `hashPassword`/`comparePassword`           | 单测            | 哈希不可逆、`compare` 正确、空口令拒绝                                                                                                                      | `api/src/utils/password.ts`                                        |
| ⑬ Zod 校验器（user/role/menu/profile）                | 单测            | 用户名正则、手机号、邮箱、密码 6~20、两次密码一致                                                                                                           | `api/src/validators/*.ts`                                          |
| ⑭ 日志脱敏一致性                                      | 单测            | 对比 `operationLog.ts:70-82`（精确匹配）与 `logger.ts:35-47`（正则）对同一输入的脱敏结果——**当前两套实现规则不一致（已知技术债 #3）**，测试先把差异暴露出来 | `api/src/middlewares/operationLog.ts`<br>`api/src/utils/logger.ts` |
| ⑮ 前端菜单树→路由映射 `buildRoutes`                   | 单测（Phase 3） | 绝对路径/相对路径均不产生 `/system/system/user` 重复拼接；`menuType==='F'` 不生成路由；`status===0` 跳过                                                    | `admin/src/store/modules/permission.ts`                            |

---

## 4. 回归策略设计

### 4.1 全量回归触发判定规则

| 改动范围                                                                                 | 触发动作                                                     | 判定依据（可脚本化）            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| 仅 `admin/**` 且不含 `utils/permission.ts`、`directives/`、`store/modules/permission.ts` | 前端 lint + `vue-tsc` + `vite build`；**后端测试可不跑**     | `git diff --name-only` 前缀匹配 |
| 仅 `admin/src/utils/permission.ts` / `directives/permission.ts`                          | **全量回归**（前后端都跑）——权限是红线，不赌                 | 白名单文件路径                  |
| 任何 `api/src/middlewares/**`                                                            | **全量回归**（中间件是全站横切）                             | 路径前缀                        |
| `api/src/routes/**`、`api/src/seed/**`                                                   | **全量回归** + **必须触发架构守卫测试 ④**（权限码/留痕快照） | 路径前缀                        |
| `api/src/models/**`、`api/src/config/database.ts`                                        | **全量回归**（含 DB 集成）                                   | 路径前缀                        |
| `api/src/services/gen*.ts`、`api/src/utils/zip.ts`                                       | 全量回归 + **必须跑代码生成产物编译测试 ⑧**                  | 路径前缀                        |
| 任何 `package.json` / lockfile                                                           | **全量回归 + 全量构建**（含 `vite build` 与 `tsc -p`）       | 文件名                          |
| 仅文档 `docs/**`、`.md`                                                                  | 只跑 prettier，**不跑测试**                                  | 路径前缀                        |
| 兜底：**判定不了就全跑**                                                                 | —                                                            | 默认分支                        |

> 这套规则建议直接写进 `scripts/ci.sh`，用 `git diff --name-only origin/master...HEAD` 实现。

### 4.2 钩子扩展：pre-commit 与 pre-push

现状：`.husky/pre-commit` = `npx lint-staged`；`.husky/commit-msg` = commitlint。**`.husky/_/pre-push*` 已存在**，新增 `.husky/pre-push` 即可，**无需重装 husky**。

```bash
# .husky/pre-commit  （在既有 npx lint-staged 之后追加）
npx lint-staged

# ── 增量类型检查：只跑"暂存区命中的子包"，避免每次提交都全量 ──
STAGED=$(git diff --cached --name-only --diff-filter=ACMR)

case "$STAGED" in
  *api/*)   echo "[pre-commit] api 类型检查…"; NODE_OPTIONS=--max-old-space-size=4096 npm --prefix api run typecheck ;;
esac
case "$STAGED" in
  *admin/*) echo "[pre-commit] admin 类型检查…"; NODE_OPTIONS=--max-old-space-size=4096 npm --prefix admin run type-check ;;
esac
```

```bash
# .husky/pre-push  （新增文件）
set -e

# ① 双端全量类型检查（防"类型错误推上远端"）
NODE_OPTIONS=--max-old-space-size=4096 npm --prefix api run typecheck
NODE_OPTIONS=--max-old-space-size=4096 npm --prefix admin run type-check

# ② 测试：无 DB 的单测必跑；DB 集成测试在数据库不可达时跳过并告警
npm --prefix api run test:unit
npm --prefix api run test:db || echo "[pre-push] ⚠️ DB 集成测试未执行（MySQL 不可达？），请在推送前补跑 npm --prefix api run test:db"

# ③ 前端构建（vue-tsc 已在 admin/type-check 覆盖，这里只验打包）
npm --prefix admin run build:only
```

> **为什么 `NODE_OPTIONS=...` 在 husky 里是安全的**：husky v9 一律用 `sh` 执行钩子（Windows 走 Git Bash），`VAR=value cmd` 语法成立。**但同样的写法放进 npm scripts 在 Windows 上会挂**（npm 默认用 `cmd.exe`）——这正是 §2.4 步骤 2 坚持用 CLI `--require` 而不是 `NODE_OPTIONS` 的原因。

### 4.3 怎么防住"lint-staged 不跑 vue-tsc"这类历史事故

历史教训：lint-staged 只跑 eslint + prettier + stylelint，**不跑类型检查**，导致类型错误被提交甚至推上远端、远端构建失败。

**三层防护（按执行顺序）**

| 层            | 机制                                                | 拦住什么                        | 成本                                      |
| ------------- | --------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| **L1 提交前** | pre-commit 追加**增量** `tsc` / `vue-tsc`（见 4.2） | 类型错误**根本进不了提交**      | 8s（api）/ 13s（admin），且仅命中子包才跑 |
| **L2 推送前** | pre-push **无条件全量** `tsc` + `vue-tsc` + 测试    | 类型错误**出不了本地**          | ~30~60s                                   |
| **L3 服务端** | CI 的 `typecheck` stage 独立成 job（见 §5）         | 钩子被 `--no-verify` 绕过时兜底 | 并行，不额外增加墙钟                      |

**关键点**：L1 用增量（快，不打断提交节奏），L2 用全量（慢但彻底）。**不要因为怕慢就放弃 L2**——13 秒的 vue-tsc 换一次"推上去 build 挂了再来回改"的往返，性价比极高。

### 4.4 逃生通道（必须写进 README）

```bash
git commit --no-verify -m "..."      # 跳过 pre-commit（仅限 WIP）
git push  --no-verify                # 跳过 pre-push（**强烈不建议**，CI 仍是最后一道）
```

约定：`--no-verify` 推送后若 CI 红，**推送者负责在 30 分钟内修复或 revert**。

### 4.5 本地 / CI 分工

| 动作                          | 本地 pre-commit         | 本地 pre-push         | CI                        |
| ----------------------------- | ----------------------- | --------------------- | ------------------------- |
| eslint / prettier / stylelint | ✅（增量，lint-staged） | —                     | ✅ 全量                   |
| `tsc` / `vue-tsc`             | ✅（增量）              | ✅ 全量               | ✅ 全量                   |
| 单测（无 DB）                 | —                       | ✅                    | ✅                        |
| DB 集成测试                   | —                       | ✅（DB 不可达则告警） | ✅（有 MySQL service 时） |
| 前端构建                      | —                       | ✅ `build:only`       | ✅                        |
| 覆盖率门禁                    | —                       | 可选                  | ✅                        |

---

## 5. CI 方案

### 5.1 选型（先说一个被忽略的事实）

**仓库 remote 是 `https://gitee.com/lanyun417/ly-admin.git`** —— 不是 GitHub，也没有 `.github/`、`.gitlab-ci.yml`。所以：

| 方案                        | 结论                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions              | ❌ 除非镜像一份到 GitHub；但语法最成熟、`services: mysql` 开箱可用                                                     |
| GitLab CI                   | ❌ 仓库不在 GitLab                                                                                                     |
| **Gitee Go**（原生）        | ✅ 托管在 Gitee，配置走 `.workflow/*.yml`；**但 MySQL service 支持未在官方文档中得到确认，且免费额度有并发与时长上限** |
| **平台无关脚本 + 分层测试** | ✅ **推荐作为主方案**                                                                                                  |

**推荐组合**：

> **① 主方案：`scripts/ci.sh`（平台无关，本地可跑）+ 测试分层**
> **② 托管 CI：Gitee Go 只跑"不需要 DB"的那一层**（lint / typecheck / `test:unit` / build），**DB 集成测试阶段设为可选/手动触发**，等确认 Gitee Go 能提供 MySQL 后再打开。
> **③ 附录保留一份 GitHub Actions 完整版**（含 `services: mysql:8.4`），将来若镜像到 GitHub 可直接用。

**为什么必须先做分层**：把测试切成 `test:unit`（**无 DB、无网络、秒级**）与 `test:db`（需真实 MySQL），CI 能力立刻从"必须有数据库服务"降级为"有个 Node 就能跑"。本次探针中 ①②③⑦ 四类测试**全部不需要 DB**，这已经覆盖了 Tier-0 里最重要的权限、JWT、菜单树、代码生成四块。

### 5.2 `scripts/ci.sh`（平台无关，核心产物）

```bash
#!/usr/bin/env bash
# 仓库根目录新增 scripts/ci.sh —— 任何 CI 平台只需调用它
set -euo pipefail

export NODE_OPTIONS=--max-old-space-size=4096   # 8GB 内存机器的 OOM 保险
STEP=${1:-all}                                   # all | lint | typecheck | test | build

run_lint() {
  npm run lint                 # eslint . --max-warnings 0（实测 12s）
  npm run format:check         # prettier --check（实测 9s）
  npm run stylelint            # stylelint（实测 7s）
}
run_typecheck() {
  npm --prefix api run typecheck          # tsc --noEmit（实测 8s）
  npm --prefix admin run type-check       # vue-tsc --noEmit（实测 13s）
}
run_test() {
  npm --prefix api run test:unit          # 无 DB，CI 必跑（实测 <2s）
  [ "${SKIP_DB_TESTS:-0}" = "1" ] || npm --prefix api run test:db
  npm --prefix api run typecheck:test     # 测试文件也要过类型检查
}
run_build() {
  npm --prefix admin run build            # vue-tsc + vite build（实测 3.5s）
  npm --prefix api run build              # tsc -p（实测 4s；注意 P0-1 产物暂不可运行）
}

case "$STEP" in
  lint) run_lint ;; typecheck) run_typecheck ;; test) run_test ;; build) run_build ;;
  all) run_lint; run_typecheck; run_test; run_build ;;
esac
```

### 5.3 Gitee Go 配置（`.workflow/ci.yml`）

```yaml
version: '1.0'
name: ly-admin-ci
displayName: LYAdmin CI
triggers:
  trigger: auto
  push:
    branches:
      precise: [master]
  pr:
    branches:
      precise: [master]
stages:
  - stage:
      name: quality
      displayName: 质量门禁
      strategy: fast # 快速失败：lint 挂了就不再往下跑
      trigger: auto
      steps:
        - step: build@nodejs
          name: lint
          displayName: 代码规范
          nodeVersion: '24.15.0'
          commands:
            - npm config set registry https://registry.npmmirror.com # 国内网络必需
            - npm ci
            - cd api && npm ci && cd ../admin && npm ci && cd ..
            - bash scripts/ci.sh lint
        - step: build@nodejs
          name: typecheck
          displayName: 类型检查
          nodeVersion: '24.15.0'
          commands:
            - bash scripts/ci.sh typecheck
        - step: build@nodejs
          name: unit-test
          displayName: 单元测试（无 DB）
          nodeVersion: '24.15.0'
          commands:
            - bash scripts/ci.sh test
          # 若平台无 MySQL：设置环境变量跳过 DB 集成
          # env: SKIP_DB_TESTS: '1'
        - step: build@nodejs
          name: build
          displayName: 构建
          nodeVersion: '24.15.0'
          commands:
            - bash scripts/ci.sh build
```

> **缓存策略**：Gitee Go 对 `node_modules` 的缓存能力需在其控制台确认。若不支持缓存，冷装三处依赖（根 275 包 + api 167 + admin 177）在国内镜像下约 **2~4 分钟**，建议：① 配 npmmirror 镜像；② 用 `npm ci`（lockfile 已齐：三处 `package-lock.json` 均存在）；③ 若平台支持缓存目录，缓存 `node_modules`、`api/node_modules`、`admin/node_modules`、`~/.npm`。

### 5.4 耗时预估（基于本机实测）

| Stage                                 | 冷启动（无缓存）        | 命中缓存         |
| ------------------------------------- | ----------------------- | ---------------- |
| 依赖安装 ×3                           | 2~4 min（国内镜像）     | 15~30 s          |
| lint（eslint + prettier + stylelint） | 28 s（12+9+7 实测）     | 28 s             |
| typecheck（tsc + vue-tsc）            | 21 s（8+13 实测）       | 21 s             |
| `test:unit`                           | 2~5 s（探针 0.5~3.4 s） | 2~5 s            |
| `test:db`（有 MySQL）                 | 15~40 s（含建表/种子）  | 15~40 s          |
| build（vite + tsc）                   | 8 s（3.5+4 实测）       | 8 s              |
| **合计（不含 DB）**                   | **约 3.5~5 min**        | **约 1~1.5 min** |
| **合计（含 DB）**                     | 约 4~6 min              | 约 1.5~2 min     |

**矩阵策略建议**

| 触发场景                 | 矩阵                        | 理由                                                                                                       |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pull Request / 日常 push | **单版本 Node 24**          | 快；本机实际就是 v24                                                                                       |
| master 合入 / 打 tag     | Node **20.x + 24.x** 双版本 | `engines: >=20.19.0`，双版本抓"只在 20 上出现"的兼容漂移（README 声明验证于 v22，实测 v24，20 从未验证过） |
| Windows 矩阵             | **暂不启用**                | Windows runner 慢 2~3 倍且 PATH/引号坑多；本项目的 Windows 兼容性由本机 pre-push 钩子保证即可              |

---

## 6. 数据与状态管理建议

### 6.1 方案对比

| 方案                                                | 隔离性 | 速度 | 真实性                              | 结论                                                                                                                                   |
| --------------------------------------------------- | ------ | ---- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 独立测试库 `ly_admin_test`**（`DB_NAME` 覆盖） | 高     | 中   | **高**（真实 MySQL 语法/类型/约束） | ✅ **推荐**                                                                                                                            |
| B. 事务包裹 + 每用例 rollback                       | 中     | 快   | 高                                  | ⚠️ 与"fire-and-forget 异步写日志"（`void appendHttpLog`、`void createOperationLog`）**天然冲突**——这些写在事务外，无法回滚，会污染数据 |
| C. 每次全库 DROP + 重建 + seed                      | 高     | 慢   | 高                                  | ⚠️ 可作为 A 的"重启动作"，但别每个用例都做                                                                                             |
| D. 内存 SQLite 替代                                 | 高     | 快   | **低**                              | ❌ 项目用了 `BIGINT.UNSIGNED`、`Op.like`、`timezone '+08:00'`、MySQL 特有行为，SQLite 语义不同，测了等于没测                           |
| E. 直接连开发库 `ly_admin`                          | **无** | 快   | 高                                  | ❌ 测试一跑就把开发数据搞脏（本次探针刻意只读，就是这个原因）                                                                          |

### 6.2 推荐方案：**A + C 组合，按文件粒度隔离**

```
独立库      ：ly_admin_test（DB_NAME=ly_admin_test）
建表        ：全局 setup 执行一次 sequelize.sync({ alter: false })，与生产同机制（P3-4 风险在测试库无妨）
种子        ：全局 setup 跑一次 seed（user.seed/role.seed/menu.seed），保证 admin/123456、三角色、菜单树齐全
用例间隔离  ：按"测试文件"粒度 —— 每个集成测试文件在 before() 中 TRUNCATE 其涉及的**业务表**（user/role/menu/file/三张日志表），再插自己的夹具
并发        ：--test-concurrency=1 跑集成测试（避免同库互踩）；unit 目录可并发
清理        ：每个集成文件 after() 必须 await sequelize.close()
```

**关键实现细节（都是本次实测踩出来的）**

1. **环境变量隔离**：`config/index.ts` 读 `DB_NAME` → 新增 `api/.env.test`，测试脚本前 `dotenv` 或 shell 注入 `DB_NAME=ly_admin_test`。`.env.test` 需加进 `.gitignore`（现有规则 `.env.*.local` 不覆盖它）。
2. **`sequelize.close()` 是硬性要求（实测证据）**：HTTP 集成测试若不 `close()`，Sequelize 连接池 `idle: 10000` 会让进程**挂满 10 秒才退出**——实测同一个 HTTP 测试文件 **11.8s → 3.0s**（§10 探针 6/9）。这一条不写，集成测试会慢 4 倍。
3. **`server.closeAllConnections()`**：`app.listen(0)` 起的服务要在 `after()` 里先 `closeAllConnections()` 再 `close()`，避免 keep-alive 连接拖住退出。
4. **随机端口**：一律 `app.listen(0, '127.0.0.1')`（本次用 59399 之类 OS 分配端口），**绝不占用 3000/5173**，也避免"服务杀不掉"的麻烦。
5. **上传目录隔离**：`UPLOAD_DIR` 与 `UPLOAD_CACHE_DIR` 在测试环境指向临时目录（如 `api/.tmp-test-uploads/`），测试后 `fs.rm -rf`；该路径加进 `.gitignore`。
6. **日志副作用**：测试环境设 `DB_LOGGING=false`、`LOG_DIR` 指向临时目录，避免测试过程产生几百行 SQL/访问日志。
7. **夹具工厂**：`tests/helpers/factory.ts` 提供 `makeUser()`、`makeRole()`、`makeMenuTree()`，字段带默认值、id 用递增序列，**不依赖种子数据的具体 id**（种子 id 会随 sync 变化）。

### 6.3 夹具示例（形状参考）

```ts
// tests/helpers/fixtures.ts
export const ROLE_CODES = { SUPER: 'super_admin', ADMIN: 'admin', VIEWER: 'viewer' } as const;

export function fakeUser(over: Partial<{ id: number; username: string; status: number }> = {}) {
  return { id: over.id ?? 9001, username: over.username ?? 'qa_user', status: over.status ?? 1, ...over };
}

export const PERM_MATRIX = [
  { role: 'viewer', code: 'system:user:list', expect: 200 },
  { role: 'viewer', code: 'system:user:remove', expect: 403 },
  { role: 'super_admin', code: 'system:user:remove', expect: 200 },
] as const; // 权限矩阵用例用参数化驱动，一条数据一个用例
```

---

## 7. 质量门禁指标体系（阶梯目标）

### 7.1 设计原则（先说清楚为什么不是"80%"）

1. **从 0 到 60% 全仓覆盖率，在 18k 行、单人维护的项目上不现实**，强行定这个数只会导致两种结果：数字造假（写无意义断言刷覆盖）或门禁天天红（然后被 `--no-verify` 绕过）。
2. **覆盖率是"结果指标"，不是"门禁指标"**。真正的红线应该是：**历史上出过事的地方，永远有测试看着**。
3. 因此本方案把门禁分成**三层**：**红线（不可协商）** → **覆盖率棘轮（只增不减）** → **阶梯目标（分阶段抬高）**。

### 7.2 红线（Red Line，任何时候都不能破，破了禁止合入）

| #   | 红线                                                                                   | 判定方式             | 当前状态                                           |
| --- | -------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| R1  | **Tier-0 的 5 组用例（①~⑤）+ 登录冒烟 ⑥ 100% 通过**                                    | CI `test` stage      | 待测（0 个用例）                                   |
| R2  | **架构守卫 ④ 通过**：无空参 `requirePermission`、写接口必带独立权限码、`viewer` 无写码 | CI `test` stage      | 当前源码合规（实测 35 处全带参），但**无测试守着** |
| R3  | **`tsc --noEmit` 与 `vue-tsc --noEmit` 均 0 error**                                    | CI `typecheck` stage | ✅ 已达标                                          |
| R4  | **eslint `--max-warnings 0`、prettier、stylelint 全绿**                                | CI `lint` stage      | ✅ 已达标                                          |
| R5  | **P0/P1 缺陷修复必须 1:1 携带回归用例**（修复 PR 里没有测试 = 不接受）                 | Code Review 检查项   | 新规                                               |
| R6  | **`admin` 前端构建成功**（`vite build`）                                               | CI `build` stage     | ✅ 已达标                                          |

### 7.3 覆盖率棘轮（Ratchet，从第 1 天就生效）

- **规则**：合并到 master 后，覆盖率**不得比上一次下降 > 1 个百分点**（绝对值）。
- **实现**：`test:cov` 的覆盖率数字写进 CI 产物；首次接入时把实测值记为基线，之后每次 PR 对比。
- **意义**：这条比任何绝对目标都有效——它**允许慢慢涨，但绝不允许悄悄掉**。

### 7.4 阶梯目标（分 4 阶段，每阶段 2~6 周）

| 阶段            | 时间窗    | 覆盖对象                                                                                                                                                            | 行覆盖                                                                                                          | 分支覆盖                                                        | 说明                                                                                                                                                                                                                   |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S0 接入期**   | 第 1~2 周 | 不设覆盖率门槛                                                                                                                                                      | —                                                                                                               | —                                                               | 唯一硬指标：Tier-0 六组用例落地 + 棘轮开启。**先把"能测"这件事跑通，不要一上来就追数字**                                                                                                                               |
| **S1 核心防护** | 第 3~6 周 | `middlewares/permission.ts`、`operationLog.ts`、`utils/jwt.ts`、`utils/tree.ts`、`services/auth.service.ts`、`services/menu.service.ts`、`services/file.service.ts` | **≥ 60%**                                                                                                       | **≥ 50%**                                                       | 这 7 个文件覆盖了 Tier-0 全部风险面。实测基线 `permission.ts` 已 100%、`tree.ts` 91.57%、`operationLog.ts` 44.53%、`auth.service.ts` 26.67% —— **S1 的实质是把 `auth.service` 和 `operationLog` 从 26%/44% 拉到 60%+** |
| **S2 面上铺开** | 第 2~3 月 | `api/src` 整体 + `admin/src/utils`、`store/modules/permission.ts`                                                                                                   | `api/src` **≥ 45%**；核心目录 **≥ 75%** / 分支 **≥ 65%**；前端 utils **≥ 60%**                                  | 全仓基线未实测，预估当前 5%~15%，45% 意味着补 ~300 个有意义断言 |
| **S3 稳态**     | 第 4~6 月 | 全仓 + E2E                                                                                                                                                          | `api/src` **≥ 60%**；核心目录 **≥ 85%** / 分支 **≥ 75%**；E2E 冒烟 **5 条核心链路**（登录→菜单→用户→角色→日志） | 到此可认为重构安全                                              |

**为什么是这些数字**：

- 60%（S1 核心目录）：核心目录多为分支密集的判定逻辑，60% 行覆盖 + 50% 分支覆盖足以覆盖"正常路径 + 主要拒绝路径"，**正好对应历史上真实出过事的那几条路径**。
- 45%（S2 全 `api/src`）：`api/src` 里含大量 `docs/`、`logging/`、`seed/`、`models/` 等低风险声明式代码，把它们算进分母时 45% 已经对应"业务逻辑基本覆盖"。
- 85%（S3 核心目录）：到这个水平，权限与留痕逻辑的**每条分支都有断言**。

### 7.5 度量与可视化

```bash
# 覆盖率 + 阈值门禁（实测：不达标 exit 1，可直接卡 CI）
node --require tsconfig-paths/register --require ts-node/register/transpile-only \
  --test --experimental-test-coverage \
  --test-coverage-lines=45 --test-coverage-branches=40 --test-coverage-functions=40 \
  --test-coverage-exclude="tests/**" --test-coverage-exclude="src/seed/**" --test-coverage-exclude="src/docs/**" \
  "tests/**/*.test.ts"

# JUnit 报告（实测可用，供 CI 展示）
... --test-reporter=junit --test-reporter-destination=coverage/junit.xml
```

| 度量项          | 采集方式                          | 频率                        |
| --------------- | --------------------------------- | --------------------------- |
| 通过率 / 用例数 | `--test-reporter=junit`           | 每次 CI                     |
| 覆盖率三列      | 内置覆盖率报告                    | 每次 CI（master）+ 每周快照 |
| 门禁是否拦截    | CI job 状态                       | 实时                        |
| 红线违反次数    | 人工登记（修 P0/P1 时是否带测试） | 每月复盘                    |

---

## 8. 落地路线图（4 个里程碑）

| 里程碑                      | 内容                                                                                                                                  | 产出物                              | 预估工时 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| **M1 跑通**（0.5 天）       | 建 `api/tests/`，加 3 个 npm scripts + `tsconfig.test.json`，写 ①②③⑤ 四组单测（约 25 个用例）                                         | `npm run test` 可跑、覆盖率报告可出 | 3~4 h    |
| **M2 红线成型**（1.5 天）   | 补 ④ 架构守卫、⑥ 登录冒烟集成、DB 集成脚手架（独立测试库 + 夹具 + `sequelize.close()` 规范），接入 pre-commit 增量类型检查 + pre-push | Tier-0 六组全绿；钩子生效           | 1~1.5 d  |
| **M3 平台化**（1 天）       | `scripts/ci.sh` + Gitee Go `.workflow/ci.yml` + `.env.test` + 上传/日志目录隔离                                                       | PR 有 CI 状态                       | 6~8 h    |
| **M4 补齐与抬门槛**（持续） | ⑦⑧⑨⑩ + Tier-2；S1→S2 覆盖率阶梯；Phase 3 评估前端 vitest                                                                              | 覆盖率阶梯达标                      | 滚动     |

**M1 的最小可交付（建议今天就做，30 分钟内能看到结果）**：加 3 行 scripts + 新建 `tests/unit/permission.test.ts`（5 个断言，照抄 §3.1 ①）。实测不到 1 秒就能看到第一个绿勾。

---

## 9. 风险与未决事项

### 9.1 ⚠️ 与 P0-1（`@/` 别名）的耦合 —— 必须先验证

HEALTH §3.1 推荐用 **Node subpath imports（`#/*`）** 修 P0-1。但测试运行器当前依赖 `tsconfig-paths` 解析 `@/*`。

**风险**：TypeScript 对以 `#` 开头的 specifier 会**优先走 `package.json` 的 `imports` 字段**，`compilerOptions.paths` 对 `#` 前缀**可能不生效**；而 `tsconfig-paths` 是按 `paths` 工作的。若 P0-1 改成 `#/*` 后 `paths` 失效，**现有测试运行方式可能整体失效**。

**5 分钟验证配方**（在决定 P0-1 方案前先跑）：

```bash
cd api
# 临时把 tsconfig 的 paths 改成 "#/*": ["./src/*"]，并把一个测试文件的 @/ 换成 #/
node --require tsconfig-paths/register --require ts-node/register/transpile-only --test "tests/**/*.test.ts"
# 若报 Cannot find module '#/xxx' → 说明方案 A 与现有 ts-node 链路冲突，需改用：
#   ① imports 字段加 "development" 条件 + --conditions=development；或
#   ② P0-1 改用方案 B（src 全量改相对路径），对测试链路零影响
```

**我的建议**：**若 P0-1 选择 `#/*` 方案，务必把这条验证作为修复的验收项之一**；从测试链路安全角度，**方案 B（相对路径）对测试零影响**，虽改动 85 个文件但可用 codemod 一次性完成。这个取舍请架构侧定夺。

### 9.2 其它风险与约束

| #   | 风险                                               | 影响                                                     | 应对                                                                                                                             |
| --- | -------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **P0-1 未修** → `npm run build` 产物不可运行       | CI 的 `build` stage 只能验证"编译成功"，不能验证"能启动" | 在 CI 里加一条 `node dist/server.js --smoke` 之类的启动冒烟，**修复 P0-1 后再开启**                                              |
| 2   | 8GB 内存，`tsc`/`vue-tsc` 可能 OOM                 | CI 与钩子                                                | 统一 `NODE_OPTIONS=--max-old-space-size=4096`（已写进 §4/§5）                                                                    |
| 3   | 端口 3000 被占用、agent 起服务杀不掉               | 集成测试                                                 | **一律 `listen(0)` 随机端口 + `after()` 强制 close**，不碰 3000/5173                                                             |
| 4   | 集成测试写脏开发库                                 | 数据                                                     | 强制 `DB_NAME=ly_admin_test`；`tests/helpers` 里加断言：**若 `config.db.name` 不含 `test` 则直接抛错拒绝执行**                   |
| 5   | `operationLog.resolveOperation` 是模块私有函数     | 可测性                                                   | 二选一：①**导出它**（1 行改动，单测最省事）；②走 HTTP + DB 断言（集成，更真实）。**推荐 ①+② 都要**：① 做规则矩阵，② 做端到端确认 |
| 6   | Gitee Go 免费额度 / MySQL service 不确定           | CI 可用性                                                | 分层测试（§5.1）；无 DB 那一层永远能跑                                                                                           |
| 7   | 前端测试成本（ESM + pinia + Element Plus + jsdom） | Phase 3                                                  | 前端 8 个权限缺口应**先修**（那是 bug），修完再用 vitest 锁住                                                                    |
| 8   | 三张日志表无清理、无索引（技术债 #2）              | 集成测试随数据增长变慢                                   | 测试库每次跑前 TRUNCATE                                                                                                          |

### 9.3 需要决策人拍板的 4 件事

1. **测试框架是否破例**：建议 Phase 1~2 走选项 C（不破例），Phase 3 前端再议。**请确认。**
2. **P0-1 方案选型**：`#/*`（方案 A）还是相对路径（方案 B）——影响测试链路，见 §9.1。**请确认。**
3. **集成测试是否允许新建数据库 `ly_admin_test`**（需要 MySQL 建库权限）。**请确认。**
4. **CI 落点**：Gitee Go（原生，MySQL 待确认）还是镜像到 GitHub 用 Actions。**请确认。**

---

## 10. 附录 A：本次实测的复现命令

> 全部为只读/临时操作，探针目录已删除（`git status` 除既有改动外无新增文件）。

```bash
# 环境
cd C:/Users/LY-VM/Desktop/ly-admin/api

# ① 纯函数单测（0.55s，4/4）
TS_NODE_TRANSPILE_ONLY=true NODE_OPTIONS="--require tsconfig-paths/register --require ts-node/register" \
  node --test __qa_probe/tree.probe.test.ts

# ② 覆盖率报告
... --test --experimental-test-coverage __qa_probe/tree.probe.test.ts

# ③ 权限中间件（5/5）
# 注意：AppError 的字段名是 httpStatus，不是 status（实测踩过一次）
... node --test __qa_probe/perm.probe.test.ts

# ④ DB 集成（真实 ly_admin，只读，1.24s）
DB_LOGGING=false ... node --test __qa_probe/db.probe.test.ts

# ⑤ 真实 HTTP 集成：createApp() + listen(0) + 原生 fetch（4/4）
#   必须 after() 里 await sequelize.close()，否则连接池 idle=10000 会让进程挂 10s（实测 11.8s → 3.0s）
DB_LOGGING=false ... node --test __qa_probe/http.probe.test.ts

# ⑥ JWT 双 Token（6/6）
DB_LOGGING=false ... node --test __qa_probe/jwt.probe.test.ts

# ⑦ 代码生成产物可编译性（0 error）
#   previewGenCode({tableName:'sys_file',moduleName:'probe',businessName:'probeItem'}) → 8 个文件
#   5 个后端文件落临时目录 + 临时 tsconfig（paths: {"@/*": ["./src/*","../../src/*"]}）→ npx tsc --noEmit

# ⑧ 目录级自动发现 + 全量（23/23，3.4s）
... node --test "__qa_probe/**/*.test.ts"

# ⑨ Windows cmd.exe 形态（模拟 npm run 的真实执行环境）—— 关键，证明命令跨平台
printf 'node --require tsconfig-paths/register --require ts-node/register/transpile-only --test "tests/**/*.test.ts"\r\n' > probe.bat
cmd //c probe.bat      # → 1/1 通过

# ⑩ 覆盖率阈值门禁（故意设 100 → exit code = 1）
... --test --experimental-test-coverage --test-coverage-include='src/utils/tree.ts' --test-coverage-lines=100 x.test.ts; echo $?

# ⑪ JUnit 报告
... --test --test-reporter=junit --test-reporter-destination=./junit.xml x.test.ts
```

**版本兼容性查询（未安装，仅 npm view）**

```
vite（admin 已装）      8.3.0
vitest                  5.0.1   peer vite: ^6.4.0 || ^7.0.0 || ^8.0.0  → ✅ 兼容
                                engines node: ^22.12.0 || ^24.0.0 || >=26.0.0 → ✅ v24.21.0
@vitest/coverage-v8     5.0.1
jsdom                   30.1.1  engines node: ^22.22.2 || ^24.15.0 || >=26.0.0 → ✅
@vue/test-utils         2.5.1
```

---

## 11. 一句话总结

> **用 Node 自带的 `node:test`，零新增依赖，先把"权限判定 / 日志留痕 / JWT 双 Token"这三条历史上真出过事（或最接近出事）的链路钉死在测试里，再配 pre-push 类型检查 + 平台无关的 CI 脚本，覆盖率用"棘轮只增不减"慢慢抬，别一上来定 80%。**
