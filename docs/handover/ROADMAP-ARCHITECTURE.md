# LYAdmin 后续技术架构演进建议（ROADMAP-ARCHITECTURE）

> 编写人：架构师（高见远） ｜ 代码基线：`master @ eb5671a` ｜ 编写方式：只读分析（**未修改任何源码，仅新增本文件**）
> 上游输入：`ARCHITECTURE-HANDOVER.md`（814 行 / 25 条技术债）、`HANDOVER.md`（P0/P1/P2 风险清单）
> 本文所有结论均带 `文件:行号` 依据；凡属推断而非实测的，均标注 **【待实测】**。

---

## 0. 本次分析的量化基线（先给数字，再给结论）

| 指标                      | 实测值                                                                                         | 获取方式                                        | 对结论的影响                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| 后端源码规模              | `api/src` 85 个 `.ts` / 10,709 行                                                              | `find src -name "*.ts"`                         | —                                                                   |
| **`@/` 别名导入处数**     | **208 处**，分布在 **58 个文件**                                                               | `grep -ro "from '@/[^']*'" src`                 | 决定 P0 修复方案的改动面                                            |
| `@/` 的其它形态           | **0 处**（无 `require("@/")`、无动态 `import("@/")`）                                          | `grep -rn "@/[a-z]" src \| grep -v "from '@/"`  | 方案 C 的重写脚本只需处理一种形态，风险可控                         |
| **dist 产物中别名残留**   | **167 处** `require("@/...")`，84 个 `.js`                                                     | `grep -ro 'require("@/' dist`                   | P0 崩溃的直接面                                                     |
| **源码目录深度**          | **最深 2 层**（根 2 个 + 13 个子目录各 1 层）                                                  | `find . -name "*.ts" \| awk -F/ '{print NF-1}'` | 方案 B 改相对路径后最坏只有 `../xxx`，可读性损失远小于预期          |
| **代码生成模板里的 `@/`** | **14 处**（`services/gen.templates.ts:255,256,257,258,342,343,389,390,391,392,393,398` 等）    | `grep -c "@/" services/gen.templates.ts`        | **新发现**：方案 A/B 必须同步改模板，否则新生成代码与项目约定不一致 |
| 日志表索引                | 仅 `models/HttpLog.ts:13` 有 `indexes`；`LoginLog.ts` / `OperationLog.ts` **无**               | `grep -n "indexes" models/*.ts`                 | 日志治理的输入                                                      |
| 编译输出形态              | `tsconfig.json:4-5` `module:node16` + package.json 无 `"type":"module"` → **CJS**，`require()` | 读配置                                          | 决定方案 A 的 `imports` 是否可省略扩展名                            |

---

## 1. 架构演进阶梯：从「能跑」到「能扩展」

### 1.1 四阶段全景

```mermaid
flowchart LR
    S0["S0 当前状态<br/>3天速成 / 单人 / 零测试 / 无CI<br/>生产启动 100% 不通"]
    G1{{"门禁 G1<br/>可部署"}}
    S1["S1 可上线<br/>部署链路通 · 安全红线闭合<br/>数据增长封顶"]
    G2{{"门禁 G2<br/>可重构"}}
    S2["S2 可演进<br/>有回归测试 · 有CI<br/>有迁移 · 有观测"]
    G3{{"门禁 G3<br/>可横向扩展"}}
    S3["S3 可扩展<br/>多实例无状态 · 缓存外置<br/>模块可插拔 · 多人协作"]

    S0 -->|"P0-1 生产启动<br/>+ S1 安全加固"| G1 --> S1
    S1 -->|"node:test + GitHub Actions<br/>+ 迁移脚本化"| G2 --> S2
    S2 -->|"会话/缓存外置<br/>+ 无状态化改造"| G3 --> S3

    S0 -.->|"跳过 G1 直接上线 = 生产事故"| X["❌ 不可接受"]
```

### 1.2 各阶段明细

| 阶段                                 | 核心目标                               | 必做项（带位置）                                                                                                                                                                                                                                                                                                                                                                                      | 完成标志（**可验证**）                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1 可上线**<br/>（建议 3~5 人日）  | 让系统能被部署、扛住流量、不出安全事故 | ① P0-1 生产启动打通（§2）<br/>② `OPERATION_RULES` 补 `log/http` + `gen/create`（`middlewares/operationLog.ts:18-38`）<br/>③ JWT 密钥强校验（`config/index.ts:51-52`）<br/>④ 生产禁 `sequelize.sync()`（`server.ts:23`）<br/>⑤ `sys_http_log` 滚动清理（§4.2）<br/>⑥ 登录频率限制（§6 S2）<br/>⑦ `/api-docs` 生产开关（`app.ts:63-64`）<br/>⑧ 4 个权限缺口补齐（D1/D2/D3 + `profile.routes.ts:17-19`） | `npm run build && npm start` 退出码 0，且 `curl :3000/api` 返回 200（**当前必崩**）<br/>`grep -c 'require("@/' api/dist` = **0**<br/>清空 HTTP 日志后 `sys_operation_log` **新增 1 条**记录<br/>删掉 `.env` 里 JWT 密钥 → 启动**立即非 0 退出**<br/>`NODE_ENV=production` 启动日志无 `syncDatabase` 建表动作<br/>连续 6 次错误登录 → 第 6 次返回 429 |
| **S2 可演进**<br/>（建议 5~8 人日）  | 让重构有回归保护，让发布有流水线       | ① `node:test` 补三条主线测试（auth / permission / log）<br/>② GitHub Actions：typecheck + lint + test + build + start 冒烟<br/>③ routeAudit 接 CI（`docs/routeAudit.ts:153`）<br/>④ 迁移脚本化替代 sync（`server.ts:23`）<br/>⑤ 健康检查分级 + metrics（§5）<br/>⑥ 统一脱敏实现（D9）<br/>⑦ 鉴权缓存（§4.1）                                                                                          | `npm test` 通过且覆盖 ≥ 3 条主线<br/>CI 在 `main` 上**全绿**，且故意删一条 catalog 条目后 CI **变红**<br/>`/api/health/ready` 在 DB 断开时返回 503<br/>重构 `auth.service.ts` 后测试无失败                                                                                                                                                           |
| **S3 可扩展**<br/>（按需，>10 人日） | 支撑多实例、多人协作、业务模块化       | ① 鉴权缓存外置（Redis）或缩短 TTL<br/>② 文件存储抽象（本地 → OSS/S3）<br/>③ `gen` 生成器插件化<br/>④ 前端路由/权限契约化（schema 校验）                                                                                                                                                                                                                                                               | 起 2 个实例 + Nginx 轮询，登录态与权限表现一致<br/>`UPLOAD_DRIVER=oss` 切换后上传链路无需改业务代码                                                                                                                                                                                                                                                  |

> **关键判断**：当前**不要**跳去 S3。S1 之前做任何"架构优化"都是在没有回归保护的情况下改一个 3 天历史的 codebase，风险收益比极差。

---

## 2. P0 生产启动修复方案对比（最高优先级）

### 2.1 问题重述与根因确认

- 现象：`npm --prefix api start`（`node dist/server.js`）必崩 `Cannot find module '@/app'`。
- 根因：`tsconfig.json:9-11` 的 `paths: {"@/*": ["./src/*"]}` 只作用于**编译期**。`tsc` 不做路径重写，dist 下 84 个 JS 全部保留 `require("@/app")` → Node 按包名解析 → 找不到 scope 包 `@`。
- dev 不受影响：`nodemon.json` 用 `ts-node -r tsconfig-paths/register src/server.ts`，运行期由 `tsconfig-paths` 兜底。
- **实测崩溃面**：dist 中 167 处 `require("@/...")`，任意一个都会触发。

### 2.2 四方案对比

| 维度                  | **A. Node subpath imports `#/*`**                                                                                                                            | **B. src 全量改相对路径**               | **C. 构建后别名重写（自研脚本）** ⭐                    | D. dist 内 `node_modules/@` 软链     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| src 改动文件数        | **58**                                                                                                                                                       | **58**                                  | **0**                                                   | 0                                    |
| src 改动行数          | **208**                                                                                                                                                      | **208**                                 | **0**                                                   | 0                                    |
| gen 模板改动          | **14 处**（`gen.templates.ts`）                                                                                                                              | **14 处**                               | **0**                                                   | 0                                    |
| tsconfig 改动         | `paths` 改 `#/*`，可能需 `customConditions`                                                                                                                  | 删 `paths`（或保留仅给 IDE）            | **0**                                                   | 0                                    |
| package.json 改动     | + `imports: {"#/*": ...}`                                                                                                                                    | 0                                       | `build` 脚本追加一行                                    | 0                                    |
| 新增文件              | 0                                                                                                                                                            | 0                                       | **1**（`scripts/rewrite-alias.mjs`，约 60 行）          | 1（构建脚本里 `ln -s`）              |
| **是否破坏 dev 链路** | **⚠️ 高风险**：若 `tsconfig-paths` 未命中 `#/*`，Node 会回退解析 package.json `imports` → **加载 `dist/` 里的旧编译产物**，表现为"改了 src 不生效"的静默错误 | 无（tsconfig-paths 仍装但无匹配，无害） | **无**                                                  | 无                                   |
| IDE 支持              | TS 官方支持；非 TS 工具链（部分 ESLint 解析器、旧版 WebStorm）对 `#` 支持参差                                                                                | **最好**                                | **最好**（源码不变）                                    | 最好                                 |
| 长期可维护性          | **最好**（Node 官方标准，业界方向）                                                                                                                          | 中（需 ESLint 规则防 `@/` 回退）        | 中（多一个自研件要维护，但**可自检**）                  | 差（hack）                           |
| 能否加自动化门禁      | 难（靠人工评审）                                                                                                                                             | 可（ESLint `no-restricted-imports`）    | **可**（脚本自检：残留 >0 则 `exit 1`，build 直接失败） | 无                                   |
| Windows / 容器兼容    | 好                                                                                                                                                           | 好                                      | 好                                                      | **差**（符号链接需特权，镜像层易丢） |
| 与"零依赖"约束        | ✅ 兼容                                                                                                                                                      | ✅ 兼容                                 | ✅ 兼容（纯 `node:fs/path`）                            | ✅ 但 hack                           |

### 2.3 推荐结论

> **推荐：第一阶段走方案 C 止血；第二阶段（进入 S2、有 CI 与测试之后）再标准化到方案 A。**

**一句话理由**：C 用「新增 1 个 60 行脚本 + package.json 1 行」换取 src/模板/tsconfig/IDE/dev 链路 **全部零改动**（0 vs 222 处改动），且能通过自检把"编译期正确、运行期崩"这类事故变成 **build 期失败**——这正是 P0-1 真正的病灶（缺自检），而不只是缺路径重写。

**为什么现在不做 A**：A 是长期正确的终点，但它要求 222 处改名，而当前**零测试、无 CI**，一次 222 处的机械改名没有任何回归保护；且 A 存在"dev 静默加载 dist 旧产物"这一**必须实测才能排除**的失败模式。在一个 3 天历史、单人维护的项目上，把高风险改动排在 S1 之前是不划算的。

**为什么不做 B**：B 的收益（去掉 tsconfig paths）在方案 C 下已经拿到（生产链路通）；成本却是 222 处改动 + 未来新代码持续写 `../` 的心智负担 + 必须靠 ESLint 长期约束。性价比低于 C。

**明确不推荐 D**：软链是能跑通的 hack，但 Windows 需管理员权限、容器镜像层易丢失、无法自检，属于"看起来零成本、实际上埋雷"。

### 2.4 方案 C 落地步骤（可直接执行）

**Step 1 — 新建 `api/scripts/rewrite-alias.mjs`**（零依赖，仅用 `node:fs` / `node:path`）

核心逻辑（约 60 行）：

```
1. 定义 ROOT = path.resolve(import.meta.dirname, '../dist')
2. 递归遍历 ROOT 下所有 .js 文件
3. 对每个文件：
   a. 读文本，用正则 /require\("@\/([^"]+)"\)/g 匹配
   b. 对每个匹配到的 spec "@/<rest>"：
      - 目标绝对路径 = path.join(ROOT, rest)        // dist 结构与 src 一致（rootDir ./src → outDir ./dist）
      - 相对于「当前文件所在目录」的相对路径 rel = path.relative(dirOf(currentFile), target)
      - 若 rel 不以 '.' 开头，强制加 './'            // Node CJS 要求相对路径必须带 ./
      - 替换为 require("<rel>")
   c. 有改动则写回文件
4. 自检：二次全量扫描 /require\("@\// ，命中数 > 0 → console.error + process.exit(1)
5. 输出统计：扫描 N 个文件，重写 M 处别名，残留 0
```

> 关键实现细节（避免踩坑）：
>
> - **只处理 `require("@/...")` 一种形态**——已实测 src 中无 `require("@/")` / 动态 `import("@/")` 其它形态（0 处）。
> - 目录型 spec 如 `@/config` → `dist/config` 是目录，相对化后 `../config`，Node CJS 会自动找 `index.js` ✅（已验证 `dist/config/index.js` 存在）。
> - **不要**用简单的字符串 `"@/"` → `"../"` 全局替换（`src` 是 2 层结构，`dist/server.js` 在根、`dist/services/*.js` 在第二层，所需前缀不同），必须按文件位置逐个计算。
> - 不做 `.js.map` 处理：sourceMap 的 `sources` 是相对路径，不含 `@/`；`sourcesContent` 里的 `@/` 不影响运行（也不宜改，改了会破坏原始源码映射）。

**Step 2 — 改 `api/package.json:9`**

```diff
- "build": "tsc -p tsconfig.json",
+ "build": "tsc -p tsconfig.json && node scripts/rewrite-alias.mjs",
```

**Step 3 — 验证命令（三条，缺一不可）**

```bash
# ① 生产链路（当前必崩，修复后必须通过）
cd api && npm run build && npm start
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api      # 期望 200

# ② 产物洁净度门禁
grep -rc 'require("@/' api/dist --include=*.js | grep -v ':0' ; echo "残留文件数应为 0"

# ③ dev 链路未被污染（回归）
npm run dev:api    # 期望正常启动，且 :3000/api 返回 200
```

**Step 4 — 把 ②③ 接进 CI**（进入 S2 时）：`build` 已含 ②（脚本自检会 exit 1），CI 再加 ③ 的冒烟即可彻底关闭此类事故。

### 2.5 方案 A 的落地步骤与**必测项**（留给 S2）

若决定直接上 A，改动清单：

1. `api/package.json` 新增：
   ```json
   "imports": { "#/*": { "default": "./dist/*" } }
   ```
   （CJS 下可省略 `.js` 后缀；若未来切 ESM 必须写成 `"./dist/*.js"`）
2. `api/tsconfig.json:9-11` 改为 `paths: { "#/*": ["./src/*"] }`；若 TS 仍按 `imports` 解析到 `dist/*`，需加 `"customConditions": ["types"]` 并改为条件映射 `{"types": "./src/*", "default": "./dist/*"}` —— **此项需实测确认，属【待实测】**。
3. 批量替换：`api/src/**/*.ts` 与 `api/src/services/gen.templates.ts` 中 222 处 `@/` → `#/`（`sed -i "s|from '@/|from '#/|g"`）。
4. `nodemon.json` 移除或保留 `-r tsconfig-paths/register`（见必测项）。

> 🔴 **必测项（否则不要合并）**：
>
> ```bash
> rm -rf api/dist && cd api && npm run dev:api
> ```
>
> **若此时服务仍能启动 → 说明 dev 在加载 dist 旧产物，方案 A 配置错误，禁止合并。**
> 正确行为：dist 不存在时 dev 应崩溃或正常从 src 加载（后者需 `tsconfig-paths` 确实命中 `#/*`）。
> 再补一测：在 `src/services/auth.service.ts` 首行加 `console.log('FROM SRC')`，`npm run dev:api` 必须打印该行。

---

## 3. 技术债偿还优先级矩阵（影响面 × 修复成本）

> 定义：**影响面** = 出问题后的爆炸半径（安全/数据/阻塞上线 = 高）；**修复成本** = 单人小时（低 < 2h ／ 中 2h~1d ／ 高 > 1d 或需数据迁移）。

```mermaid
quadrantChart
    title 技术债四象限（影响面 × 修复成本）
    x-axis "修复成本 低" --> "修复成本 高"
    y-axis "影响面 低" --> "影响面 高"
    quadrant-1 "Q2 排期还（Plan）"
    quadrant-2 "Q1 立刻还（Now）"
    quadrant-3 "Q3 改到再说（Opportunistic）"
    quadrant-4 "Q4 永远别动（Never）"
    "D1 roles/all 无码": [0.12, 0.85]
    "D2 upload 页无指令": [0.15, 0.82]
    "D3 user 开关无指令": [0.10, 0.80]
    "D4 gen/create 无留痕": [0.08, 0.95]
    "D7 JWT 默认密钥": [0.12, 0.98]
    "D11 生产自动 DDL": [0.20, 0.88]
    "D12 api-docs 公开": [0.18, 0.72]
    "D13 403 整页跳": [0.15, 0.60]
    "D14 前端 fail-OPEN": [0.10, 0.78]
    "D9 两套脱敏": [0.22, 0.55]
    "N1 上传无 magic bytes": [0.28, 0.62]
    "D5 日志无清理": [0.68, 0.92]
    "D16 日志表零索引": [0.55, 0.80]
    "D8 鉴权无缓存": [0.62, 0.60]
    "D6+N9 图片缓存": [0.60, 0.75]
    "N2 无登录限频": [0.48, 0.85]
    "N3 健康检查无 DB 探测": [0.42, 0.45]
    "N4 无 metrics/自检": [0.72, 0.40]
    "D10 schema 重复": [0.15, 0.20]
    "D17 三模块无 validator": [0.45, 0.35]
    "D19 ROUTE_NAME 覆盖表": [0.35, 0.18]
    "D20 require.main": [0.12, 0.15]
    "D22 logout 空实现": [0.65, 0.30]
    "D23 未使用 API": [0.05, 0.10]
    "D24 命名不统一": [0.10, 0.08]
    "文档不一致 3 处": [0.12, 0.22]
    "D21 tar 依赖": [0.75, 0.20]
    "D25 docs 重叠": [0.70, 0.12]
    "补外键约束": [0.85, 0.15]
    "方案B 全量相对路径": [0.88, 0.35]
```

### Q1 — 立刻还（高影响 × 低成本）｜建议 S1 内全部清掉

| ID       | 位置                                                                           | 动作                                                                                                                                                                               | 验收标准                                                                                                                      |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D4       | `api/src/middlewares/operationLog.ts:18-38`                                    | 往 `OPERATION_RULES` 补两条：`/^\/api\/logs\/http$`（模块「日志管理」动作「清空HTTP日志」）、`/^\/api\/gen\/create$`（模块「代码生成」动作「生成到项目」）                         | 执行清空 HTTP 日志后，`sys_operation_log` 新增 1 条 `module='日志管理'` 记录；执行 gen create 后新增 1 条 `module='代码生成'` |
| D7       | `api/src/config/index.ts:51-52` + `.env.example:12-13`                         | 生产环境（`NODE_ENV=production`）缺 `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` 或为默认值 → `console.error` + `process.exit(1)`；`.env.example` 改为 `CHANGE_ME_xxx` 占位            | 删掉 `.env` 中两行密钥后 `NODE_ENV=production npm start` → 退出码非 0 且日志含明确字段名                                      |
| D1       | `api/src/routes/role.routes.ts:30`                                             | 补 `requirePermission('system:role:list')`（或新建 `system:role:option` 仅授予有 `system:user:assignRole` 的角色）                                                                 | 用 viewer 账号 `GET /api/roles/all` → 403                                                                                     |
| D2       | `admin/src/views/upload/index.vue:119-132`（上传区）、`:177`（删除按钮）       | 加 `v-permission="'file:upload'"` / `v-permission="'file:remove'"`                                                                                                                 | 以 viewer 登录，上传区与删除按钮**不可见**                                                                                    |
| D3       | `admin/src/views/system/user/index.vue:184`                                    | `el-switch` 加 `v-permission="'system:user:edit'"`                                                                                                                                 | viewer 登录看不到状态开关                                                                                                     |
| D14      | `admin/src/utils/permission.ts:10-12`、`directives/permission.ts:11-13`        | 空码/无效码 → 返回 `false`（fail-closed）；dev 环境 `console.warn`                                                                                                                 | 传 `v-permission="''"` → 元素被移除                                                                                           |
| D13      | `admin/src/api/request.ts:120-126`、`:143-150`                                 | 403 默认只 `ElMessage.error`；仅路由守卫/页面初始化请求失败才跳 `/403`                                                                                                             | 点击无权限按钮 → 页面**不跳转**，仅提示                                                                                       |
| D11      | `api/src/server.ts:23`                                                         | `syncDatabase()` 外包一层：`NODE_ENV !== 'production'` 才执行                                                                                                                      | `NODE_ENV=production` 启动，日志无建表动作；且缺表时启动**明确报错**而非自动建                                                |
| D12      | `api/src/app.ts:63-64`                                                         | `registerDocsRoutes(app)` 前加 `if (config.docs.enabled)`；`config/index.ts` 新增 `docs.enabled = env !== 'production'`                                                            | `NODE_ENV=production` 时 `/api-docs` 返回 404                                                                                 |
| D9       | `api/src/middlewares/operationLog.ts:70-82` vs `api/src/utils/logger.ts:35-47` | 抽到 `api/src/utils/mask.ts` 导出 `maskSensitive()`，两处都改为引用；字段清单以 `constants/index.ts:68 SENSITIVE_KEYS` 为准并补充 `token/secret/authorization`                     | 全仓 `grep -n "SENSITIVE_KEY_RE"` 只剩 1 处定义；两处脱敏对同一输入输出一致                                                   |
| **N1**   | `api/src/middlewares/upload.ts:35-44`                                          | **新发现**：白名单依赖 `file.mimetype`（来自客户端 multipart 头，**可伪造**）。在 `fileFilter` 之后增加 magic bytes 校验（读前 8 字节比对 PNG/JPEG/GIF/WEBP/PDF 签名），不符即拒绝 | 用 `curl -F "file=@evil.php;type=image/png"` 上传 → 400，磁盘上**无文件**                                                     |
| **P0-1** | 生产启动（§2）                                                                 | 方案 C                                                                                                                                                                             | 见 §2.4 Step 3                                                                                                                |

### Q2 — 排期还（高影响 × 高成本）｜建议 S1~S2 分批

| ID          | 位置                                                                                                                | 动作                                                                                                                                                                                                                                                                                                 | 目标指标                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D5          | `services/log.service.ts:204`（只有 `clearHttpLogs` 全表 TRUNCATE）、`models/LoginLog.ts`、`models/OperationLog.ts` | 三张表分别做清理（详见 §4.2）                                                                                                                                                                                                                                                                        | 各表有按时间范围清理能力 + 定时归档                                      |
| D16         | `models/LoginLog.ts`、`models/OperationLog.ts`                                                                      | 补索引（详见 §4.2 表 4-2）                                                                                                                                                                                                                                                                           | 列表查询走索引，`EXPLAIN` 无 `ALL`                                       |
| D8          | `services/auth.service.ts:115-124`                                                                                  | 加进程内 TTL 鉴权缓存（详见 §4.1）                                                                                                                                                                                                                                                                   | 鉴权链路 SQL 数下降 ≥ 80%                                                |
| D6 + **N9** | `services/image.service.ts:87-92`（`buildCachePath`）                                                               | **新发现的真实缺陷**：缓存文件名为 `basename + _s{scale} + ext`，**不含源文件目录信息** → ① `uploads/a/x.png` 与 `uploads/b/x.png` 会**串用同一个缓存文件**（返回错误图片）；② 源文件删除后无法关联定位缓存（D6 无法根治的根因）。先改 key 为「源路径相对 uploads 的 slug + hash」，再上淘汰（§4.3） | 两个不同目录同名图片的缓存文件路径**不同**；删源文件后缓存可精确定位清理 |
| **N2**      | `routes/auth.routes.ts`（login）                                                                                    | 新增零依赖滑动窗口限频（详见 §6 S2）                                                                                                                                                                                                                                                                 | 连续 6 次失败登录 → 429                                                  |
| **N3/N4**   | `app.ts:52-58`、`server.ts:16`                                                                                      | 健康检查分级 + 启动自检 + metrics（详见 §5）                                                                                                                                                                                                                                                         | `/api/health/ready` 断 DB 时返回 503                                     |

### Q3 — 改到再说（低影响 × 低成本）｜路过就顺手改

| ID   | 位置                                                                                        | 动作                                                                                          |
| ---- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D10  | `validators/{user,menu,role}.validator.ts`                                                  | `idParamSchema` 抽到 `validators/common.ts`（3 处合一）                                       |
| D17  | `controllers/log.controller.ts`、`file.controller.ts`、`gen.controller.ts`                  | 补 zod validator，与 users/roles/menus 对齐（**新写的模块必须先有 validator**）               |
| D18  | `docs/routeAudit.ts:153`                                                                    | 接 CI：diff > 0 即 fail（成本低，价值高，建议随 S2 的 CI 一起做）                             |
| D19  | `admin/src/store/modules/permission.ts:36-38`                                               | 约定组件 `defineOptions({name})` = `PascalCase(path)`，逐步去掉覆盖表                         |
| D20  | `api/src/seed/index.ts:21`                                                                  | `require.main === module` → 统一为 CJS 或改 `import.meta`（当前靠 ts-node 编译成 CJS 才能跑） |
| D22  | `services/auth.service.ts:238`                                                              | `logout()` 空实现；短期接受，中期在 `sys_user` 加 `token_version` 字段做软吊销                |
| D23  | `admin/src/api/auth.ts:30`                                                                  | `getPermissionsApi` 未使用 → 删除或注明保留原因                                               |
| D24  | `controllers/dashboard.controller.ts` 等                                                    | `_req` / `req` 命名统一                                                                       |
| 文档 | `routes/index.ts:3`（注释写 8 个实为 9）、`docs/catalog.ts:1771`（示例 `total:47` 实为 52） | 订正两处陈旧文案                                                                              |

### Q4 — 永远别动（低影响 × 高成本 / 收益已被替代）

| 项                                             | 位置                                          | 为什么别动                                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D21 archiver 依赖系统 `tar`                    | `api/src/logging/archiver.ts:79`              | 已有 `TAR_BIN` 环境变量兜底（`config/index.ts:95`）；自研 zlib 回退需重写归档 + 处理中文路径 + 跨平台，成本远高于收益。要动也是在容器基础镜像里装 `tar`        |
| D25 根目录 `docs/` 与 `api/src/docs/` 概念重叠 | 仓库根 `docs/`                                | 整理成本高、收益低。**正确做法不是整理，而是定边界一句话**：`ARCHITECTURE.md`=设计期、`docs/handover/`=接手期、`system_design.md`=归档，三者在开头互相链接即可 |
| 给 `sys_menu.parent_id` 补外键约束             | `models/Menu.ts:73-77`（`constraints:false`） | 补外键要处理存量脏数据 + 改所有级联删除语义，而父子完整性已由 `menu.service.ts` 在 service 层保证。成本高风险高                                                |
| **方案 B：src 全量改相对路径**                 | 全仓 222 处                                   | 收益（生产链路通）已被方案 C 以 1/222 的成本拿到；且会引入"未来新代码写 `@/` 又崩"的长期约束成本                                                               |
| 把 `sys_*` 表改名/重构为领域模型               | `models/*.ts`                                 | 表名已与前端、种子、文档、SQL 日志深度耦合；纯重命名收益为 0                                                                                                   |

---

## 4. 性能与可扩展性专题

### 4.1 鉴权链路缓存（`loadAuthUser` 每请求 2~3 次 SQL）

**现状与量化**

| 项                 | 值                                                                                              | 依据                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 每次鉴权请求的 SQL | `User.findByPk(include Role)`（1~2 条）+ `Menu.findAll(JOIN sys_role_menu)`（1 条）= **2~3 条** | `services/auth.service.ts:116`、`:88-100` |
| 触发面             | 所有挂 `authenticate` 的路由（9 个业务路由模块中绝大部分）                                      | `routes/*.routes.ts`                      |
| 100 QPS 下的开销   | ≈ **300 SQL/s**，其中 >95% 是重复查询                                                           | 推算                                      |

**方案：进程内 TTL 缓存 + 主动失效钩子（零依赖）**

新增 `api/src/services/authCache.ts`：

```
Map<number /*userId*/, { ctx: AuthContext; expireAt: number }>
TTL = 30_000 ms        // 权限变更最多 30s 生效，符合当前"下次请求才生效"的既有语义
MAX_ENTRIES = 2000     // 超限按插入顺序淘汰最旧（简单 FIFO 足够，用户量远小于此）
```

在 `auth.service.ts:115` 的 `loadAuthUser` 开头查缓存（命中且未过期 → 直接返回；`expireAt` 到了 → 删并重查），在 `:123` 返回前写入。

**失效策略（分层，按变更频率决定粒度）**

| 触发点                  | 位置                                       | 失效粒度              | 理由                                                                                 |
| ----------------------- | ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------ |
| 分配/回收角色           | `services/user.service.ts`（assignRoles）  | **单 userId**         | 高频、目标明确                                                                       |
| 改用户状态（禁用/启用） | `services/user.service.ts`（changeStatus） | **单 userId**         | 同上                                                                                 |
| 改密 / 重置密码         | `services/auth.service.ts`、`:168 refresh` | **单 userId**         | 同上                                                                                 |
| 角色授权菜单            | `services/role.service.ts`（assignMenus）  | **全清 `clearAll()`** | 一个角色的菜单变更影响所有持有者，反查成本高；**角色变更是低频操作**，全清代价可接受 |
| 菜单增删改 / 改状态     | `services/menu.service.ts`                 | **全清 `clearAll()`** | 同上，且必须顺带修 D15（`collectPermissions` 不校验父菜单状态）                      |
| 角色改状态              | `services/role.service.ts`                 | **全清 `clearAll()`** | 同上                                                                                 |

> **为什么不做"把权限塞进 JWT"**：JWT 一旦签发在 2h（`config/index.ts:53`）内不可撤销，而本项目已实现「改密后旧 Token 全部失效」（`middlewares/auth.ts:53-58` 依赖 `password_changed_at`）——把权限塞进 JWT 会让**改权限**也变得不可撤销，是安全语义的倒退。缓存 + 主动失效是更优解。

**风险与边界（必须写明）**

- **多实例部署时各实例缓存不一致**，最坏延迟 = TTL = 30s。当前单实例部署可接受；进入 S3（多实例）时必须改为 Redis 或把 TTL 压到 5s。**不要**在 S2 之前为此引入 Redis。
- 缓存对象含 Sequelize 模型实例（`user`），**必须只缓存不可变字段**或改为缓存 POJO，避免业务代码误改缓存中的实例造成脏读。建议：只缓存 `{ userId, username, status, roleCodes, permissions, passwordChangedAt }` 这一 POJO，`loadAuthUser` 的返回结构保持兼容。

**验收**

- dev 环境在 `authCache` 加 `hit/miss` 计数并在日志打印；压测 100 并发 60s，对比 `api/logs/db/YYYY-M-D.log` 的 SQL 条数，**下降应 ≥ 80%**。
- 手工验证失效：修改某用户角色后 30s 内权限生效（或立即——若走了主动失效钩子则应**立即**生效，这点是修复而非退步）。

### 4.2 三张日志表的归档 / 索引策略（**三张表策略必须不同**）

**先算增长量级（决定谁最急）**

| 表                  | 每条大小估算                                                                                        | 触发频率                                        | 日增量估算（100 QPS 场景）  | 紧迫度      |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------- | ----------- |
| `sys_http_log`      | 含 `query`(JSON) + `reqBody`/`resBody`(TEXT，resBody 上限 2048B，`utils/logger.ts:29`)，平均 ≈ 1 KB | **每个 HTTP 请求一条**                          | **≈ 8.6 GB/天**（864 万条） | 🔴 **最急** |
| `sys_operation_log` | 含 `params`(TEXT 脱敏 JSON)，≈ 0.5 KB                                                               | 仅写操作（命中 `OPERATION_RULES` 的 14 条规则） | ≈ 数十 MB/天                | 🟠 中       |
| `sys_login_log`     | 极小（无 TEXT 大字段）                                                                              | 仅登录事件                                      | < 1 MB/天                   | 🟢 低       |

> 结论：**`sys_http_log` 是唯一的磁盘炸弹**，必须优先处理；另两张表的核心问题是"只增不减 + 无索引"而非体量。

**表 4-2：三张表的差异化治理方案**

| 表                                                       | 保留期                                                 | 索引补法                                                                                                                                                                        | 清理方式                                                                                                                                             | 归档方式                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **`sys_http_log`**<br/>（`models/HttpLog.ts`）           | **7 天**（可配 `HTTP_LOG_RETENTION_DAYS`）             | 现有 `idx_time`/`idx_method`/`idx_status_code`/`idx_method_time`（`:13-18`）**已够**。<br/>**不要**给 `url`(1024) / `reqBody`(TEXT) 建索引——TEXT 必须指定前缀长度且写入放大严重 | **必须废弃全表 TRUNCATE**，改为**分批 DELETE**：`DELETE FROM sys_http_log WHERE time < ? LIMIT 1000` 循环 + 每批 `sleep(50ms)`，避免长事务与主从延迟 | 不归档（体量太大、价值最低）。**先导出当天 CSV 再删**可选                                           |
| **`sys_operation_log`**<br/>（`models/OperationLog.ts`） | **365 天**（审计留痕要求，这是"谁改了什么"的唯一证据） | 补 `idx_created_at`、`idx_module_created_at`、`idx_user_id`<br/>（`module` 基数低，必须做成联合索引放后面）                                                                     | 按时间范围 DELETE（同样分批，1000/批）                                                                                                               | **清理前强制导出 CSV 到 `logs/archive/`**（复用现有 `logging/archiver.ts` 的目录约定），保留 ≥ 3 年 |
| **`sys_login_log`**<br/>（`models/LoginLog.ts`）         | **180 天**                                             | 补 `idx_login_at`、`idx_username_login_at`                                                                                                                                      | 同上，按时间范围分批 DELETE                                                                                                                          | 同上，CSV 归档                                                                                      |

**落地清单**

1. `api/src/config/index.ts` 新增：`httpLog.enabled`（默认 `true`，生产建议 `false` 或仅采样 10%）、`log.retentionDays`（三表分别配置）。
2. `api/src/logging/httpLogStore.ts:45` 落库前检查 `config.httpLog.enabled` —— **这是唯一的治本手段**，比事后清理有效一个数量级。
3. `api/src/services/log.service.ts:204` `clearHttpLogs()` 从 `HttpLog.truncate()` 改为 `deleteBefore(date)` 分批实现；新增 `deleteOperationLogsBefore` / `deleteLoginLogsBefore`。
4. `api/src/routes/log.routes.ts` 新增三个清理接口，**每个都必须有独立权限码**（`log:http:clear` / `log:operation:clear` / `log:login:clear`），**且这三个接口本身必须进 `OPERATION_RULES`**（否则又是一个 P0-2）。
5. 复用 `logging/scheduler.ts:56 startLogScheduler` 的自调度模式（零依赖，已验证可用），把清理任务挂进去，每日 00:05 与日志归档一起跑。建议把 `startLogScheduler` 更名为 `startMaintenanceScheduler` 或在其内部追加调用。
6. `api/src/models/{LoginLog,OperationLog}.ts` 补 `indexes`（配合 `server.ts:23` 的 `sync({alter:false})`，**新增索引不会自动建** → 必须随 S2 的迁移脚本一次执行，或首次上线前手工执行 DDL）。

**验收**

- 连续跑 7 天后 `sys_http_log` 行数稳定（不再单调增长）；
- `EXPLAIN SELECT ... WHERE module=? ORDER BY created_at DESC LIMIT 20` 的 `type` 不是 `ALL`；
- 清理接口执行后 `sys_operation_log` 有对应留痕记录。

### 4.3 图片缩放缓存淘汰

**现状（`services/image.service.ts`）**

| 项                   | 值                                                                                | 依据                       |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| 缓存目录             | `api/cache/images`（刻意放在 `upload.dir` 之外，防公开访问 ✅）                   | `config/index.ts:63-67`    |
| 缓存 key             | `basename + '_s' + scale.toFixed(2) + ext`                                        | `:87-92 buildCachePath`    |
| **缺陷 1（新发现）** | key **不含源文件目录** → 不同目录下同名图片**串用缓存**                           | `:89` 只用 `path.basename` |
| **缺陷 2**           | scale 归一化到 2 位小数（`:83`）→ 单张图最多可产生 **90 个**缓存变体（0.10~0.99） | `:83`                      |
| **缺陷 3**           | 无任何淘汰，源文件删除后缓存残留（D6）                                            | 全文件无删除逻辑           |
| 并发保护             | `inflight` Map + 临时文件原子 rename ✅（**写得很好，别动**）                     | `:37`、`:140-144`          |

**修复方案（三步，按顺序）**

**Step 1 — 修 key（前置条件，不做 Step 1 则 Step 3 无法精确清理）**

```ts
// services/image.service.ts:87-92
function buildCachePath(sourceAbsPath: string, scale: number): string {
  const ext = path.extname(sourceAbsPath).toLowerCase();
  const base = path.basename(sourceAbsPath, ext);
  // 新增：把「源文件相对上传根目录的路径」做短哈希，避免不同目录同名串用
  const rel = path.relative(config.upload.dir, sourceAbsPath); // 如 "2024/10/a.png"
  const slug = crypto.createHash('sha1').update(rel).digest('hex').slice(0, 12);
  return path.join(config.upload.cacheDir, `${base}_${slug}_s${scale.toFixed(2)}${ext}`);
}
```

（`node:crypto` 是内置模块，**不违反零依赖约束**）

**Step 2 — 收敛变体数量（可选但推荐）**

把 `parseScale`（`:63-84`）的输出**吸附到离散档位** `[0.1, 0.2, 0.25, 0.33, 0.5, 0.75]`，向下取最近档。
收益：单图缓存变体从 **90 个 → 最多 6 个**，磁盘放大系数下降 93%。代价：实际缩放比例与请求值有 ≤ 40% 偏差（对缩略图场景完全可接受）。

**Step 3 — 淘汰（复用现有调度器，零依赖）**

新增 `api/src/services/imageCache.ts`：

| 函数                                 | 行为                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `purgeExpiredCache(maxAgeMs = 7d)`   | 遍历 `config.upload.cacheDir`，`stat.mtime` 早于阈值 → `fs.promises.rm`；返回 `{scanned, removed, bytesFreed}` |
| `purgeOverQuota(maxBytes = 1GB)`     | 若目录总大小超配额，按 `mtime` 升序删除最旧文件直到回到配额内                                                  |
| `purgeCacheForSource(sourceAbsPath)` | 按 `base + slug` 前缀匹配删除该源图的所有 scale 变体（**依赖 Step 1**）                                        |

挂载点：

- **定时**：`logging/scheduler.ts:56 startLogScheduler()` 内部追加 `void purgeExpiredCache().then(purgeOverQuota)`（与归档同批次，每日一次）。
- **联动**：`services/file.service.ts:184` `fs.unlinkSync(absolutePath)` **之后**调用 `purgeCacheForSource(absolutePath)` —— 这是"删源文件即删缓存"，从根上解决 D6。

**验收**

- 删除一个上传文件后，`api/cache/images` 中对应 `_s*.ext` 全部消失（1 次维护周期内）；
- 两个不同目录下同名图片各请求一次 `?scale=0.5`，缓存目录下产生 **2 个不同文件**，且各自返回正确图片；
- 连续运行 14 天，`du -sh api/cache/images` 稳定在配额内。

---

## 5. 可观测性与运维缺失项（最小可行方案）

### 5.1 健康检查分级

**现状**：`app.ts:52-58` 的 `GET /api` 返回 `{name, status:'ok', time}`，**永远返回 ok，不探测任何依赖**（DB 挂了也报 ok → 负载均衡会持续把流量打到死节点）。

**最小方案**（保持 `/api` 兼容，新增两个分级端点）：

| 端点                    | 探测内容                                                  | 失败行为                                  | 用途                                                  |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `GET /api`（**不动**）  | 无                                                        | 200                                       | 兼容现状 + 人工探活                                   |
| `GET /api/health/live`  | 仅进程存活                                                | 200                                       | K8s liveness（**不查 DB**，避免 DB 抖动触发重启循环） |
| `GET /api/health/ready` | `sequelize.authenticate()`（**超时 2s**）+ 返回 `{db:'up' | 'down', uptime, memMB, version, nodeEnv}` | DB 不可达 → **503**                                   | K8s readiness / 发布前置校验 |

> 🔴 **必须注意的耦合**：健康检查端点位于 `/api/` 前缀下，会被 `utils/logger.ts:135 httpAccessLogger()` 捕获并**双写文件 + `sys_http_log`**。K8s 探针若按 5s 一次，单是探针就会产生 **17,280 条/天**。
> **处理**：在 `httpAccessLogger`（`utils/logger.ts:141`）的排除规则里加上 `/api/health/`，与现有 `/api/logs/*` 的排除逻辑同款写法。

### 5.2 启动自检（`server.ts:16 bootstrap`）

在 `app.listen` **之前**插入自检序列，任一失败 → 打印明确错误 + `process.exit(1)`：

| #   | 检查项                                                                  | 失败处理                   |
| --- | ----------------------------------------------------------------------- | -------------------------- |
| 1   | JWT 密钥非默认且非空（生产）                                            | 立即退出（与 D7 合并实现） |
| 2   | `config.upload.dir` / `config.upload.cacheDir` 存在且**可写**           | 立即退出                   |
| 3   | `config.log.dir` 可写（否则归档与错误日志全废）                         | 立即退出                   |
| 4   | DB 连通（`connectDatabase()` 已有，补充：打印库名 + 版本 + 连接池配置） | 立即退出                   |
| 5   | 监听端口未被占用                                                        | 已有（listen error）       |

输出形如 `[Boot] ✓ DB  ly_admin@8.0.x  ✓ uploads 可写  ✓ cache 可写  ✓ JWT 密钥已配置`，一行可查。

### 5.3 Metrics（零依赖最小版）

**先做 JSON，不急上 Prometheus**：新增 `api/src/utils/metrics.ts`（进程内计数器，约 80 行，纯对象累加）：

| 指标                                         | 来源                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `http_requests_total{method,status}`         | `utils/logger.ts:135` 的 finish 钩子（已有埋点位置）           |
| `http_request_duration_ms_bucket`            | 同上（`duration` 已在采集）                                    |
| `db_queries_total` / `db_slow_queries_total` | `config/database.ts:21-36` 的 logging 钩子（已有 `slow` 判定） |
| `auth_cache_hit/miss`                        | §4.1 新增                                                      |
| `log_rows{type}`                             | 清理任务执行后写入                                             |
| `process_uptime_seconds` / `mem_rss_bytes`   | `process.uptime()` / `process.memoryUsage()`                   |

暴露 `GET /api/metrics`（**需挂 `authenticate` + `requirePermission('system:monitor:view')`**，不要裸奔）。
后续若接入 Prometheus，只需把 JSON 序列化成 text exposition 格式（仍是纯字符串拼接，零依赖），**接口与采集逻辑不变**。

### 5.4 `/api-docs` 生产暴露（补充 §3 D12 的实现选项）

| 选项               | 成本 | 说明                                                                                                                            |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| **推荐：开关关闭** | 极低 | `config.docs.enabled = env !== 'production'`；生产直接不注册路由（`app.ts:63-64`）。内网部署时可用 `DOCS_ENABLED=true` 显式打开 |
| 备选：Basic Auth   | 低   | 零依赖实现：读 `Authorization: Basic`，用 `crypto.timingSafeEqual` 比对 `DOCS_USER/DOCS_PASS` 的环境变量值。约 20 行            |

> 选开关关闭的理由：文档暴露的**全部权限码清单**（`docs/catalog.ts` 每个 endpoint 的 `permission` 字段）等于一张"权限模型地图"，配合 D1 这类缺口就是完整的攻击面。生产默认关闭、按需显式打开，是最省事也最安全的。

---

## 6. 安全加固清单（按风险排序）

| 序      | 风险                                                                                                                                              | 位置                                                             | 加固动作                                                                                                     | 等级                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **S1**  | **JWT 默认密钥当前正在使用**——`api/.env` 用的就是 `ly_admin_access_secret` / `ly_admin_refresh_secret`，可直接伪造任意用户（含 super_admin）Token | `api/src/config/index.ts:51-52`、`api/.env.example:12-13`        | 生产缺密钥或为默认值 → `process.exit(1)`；生成新密钥（`openssl rand -base64 48`）；`.env.example` 改为占位符 | 🔴 致命                                                                                                           |
| **S2**  | **无登录频率限制**——可无限暴力破解（且每次失败都写 `sys_login_log`，还顺带放大日志表）                                                            | `api/src/routes/auth.routes.ts`（login）                         | 零依赖滑动窗口：`Map<'ip                                                                                     | username', number[]>`，5 次/5 分钟 → 锁 15 分钟（返回 429）；成功登录清空计数；**注意单实例内存态，多实例需外置** | 🔴 高 |
| **S3**  | **`/api/roles/all` 无权限码**——任意登录用户（含 viewer）可枚举全部角色含 `super_admin`                                                            | `api/src/routes/role.routes.ts:30`                               | 补独立码 `system:role:option`，仅授予持有 `system:user:assignRole` 的角色                                    | 🟠 中高                                                                                                           |
| **S4**  | **`/api-docs` 公开暴露全量接口 + 全部权限码**                                                                                                     | `api/src/app.ts:63-64`                                           | 生产默认关闭（§5.4）                                                                                         | 🟠 中高                                                                                                           |
| **S5**  | **`/api/profile` 三个写接口无权限码**——viewer 可改自己资料/密码/头像                                                                              | `api/src/routes/profile.routes.ts:17-19`                         | 二选一并写进注释：① 认定为"个人资料豁免"（需评审确认）；② 补 `profile:edit` 码并授予所有角色                 | 🟠 中                                                                                                             |
| **S6**  | **上传类型校验可被伪造**——`file.mimetype` 来自客户端 multipart 头                                                                                 | `api/src/middlewares/upload.ts:35-44`                            | 加 magic bytes 校验（前 8 字节签名比对），见 §3 Q1 N1                                                        | 🟠 中                                                                                                             |
| **S7**  | **CORS 单值写死** `http://localhost:5173`——多环境/多域名部署即 100% 跨域失败；当前单值虽不是 `*`，但无法支撑多前端                                | `api/src/config/index.ts:74`                                     | 改为逗号分隔白名单数组 + **精确匹配**（禁止 `*` 与 `credentials:true` 同用）；未命中时拒绝并在日志 warn      | 🟠 中                                                                                                             |
| **S8**  | **生产 `sequelize.sync()` 自动 DDL**——应用可在无人知晓的情况下改表结构                                                                            | `api/src/server.ts:23`                                           | `NODE_ENV=production` 跳过 sync，改由迁移脚本执行（S2）                                                      | 🟡 中低                                                                                                           |
| **S9**  | **审计可被绕过**：`log:http:clear` 能一次性抹掉全部访问证据，且当前**自身不留痕**（P0-2）                                                         | `api/src/routes/log.routes.ts:29`、`services/log.service.ts:204` | ① 该接口进 `OPERATION_RULES`；② 改为按时间清理而非全表 TRUNCATE；③ 清理前强制导出 CSV                        | 🟡 中低                                                                                                           |
| **S10** | **登出无状态**——Token 签发后 2h 内无法吊销                                                                                                        | `api/src/services/auth.service.ts:238`                           | 短期接受（已有改密失效机制兜底）；中期加 `sys_user.token_version` 字段做软吊销                               | 🟢 低                                                                                                             |
| **S11** | **两套脱敏规则不一致**——新增敏感字段易漏改其中一处                                                                                                | `middlewares/operationLog.ts:70-82` vs `utils/logger.ts:35-47`   | 统一到 `utils/mask.ts`（§3 Q1 D9）                                                                           | 🟢 低                                                                                                             |

---

## 7. 架构原则建议（今后必须遵守）

> 每条原则都要能回答一个问题：**它防的是什么事故？**

### 原则 1｜自研件必须自带自检断言

- **内容**：项目内的零依赖自研件（接口文档 `docs/`、ZIP `utils/zip.ts`、代码生成 `services/gen.*.ts`，以及今后新增的任何自研件）**必须同时提供一条可自动执行的自检**，并把自检接进构建或 CI。
- **防的是什么**：**P0-1 就是这条原则缺失的直接后果**——`@/` 别名策略在编译期"看起来正确"，却没有任何机制在构建期断言"产物能被 Node 解析"，直到 `npm start` 才崩，而这条链路 3 天里从没被执行过。同理，`routeAudit.ts:153` 已经算出了文档 diff 却只 `console.log` 不阻断，是自检信息被浪费。
- **落地**：方案 C 的重写脚本末尾扫描残留 → `exit 1`；`auditDocsCoverage` 在 CI 中 diff > 0 → fail。

### 原则 2｜权限判定前后端一律 fail-closed，写操作必须独立码

- **内容**：任何权限判定点（后端 `requirePermission`、前端 `hasPermission` / `v-permission`）遇到**空码 / 未知码 / undefined**，一律**拒绝**；写操作与破坏性操作必须拥有独立权限码，禁止复用 `:list` / `:query`。
- **防的是什么**：本项目**已经出过一次 P0 越权事故**（只读 viewer 因 `log:http:clear` 复用了 `log:http:list` 而能清空全量日志，见提交 `c41b459`）。而当前后端已 fail-closed（`permission.ts:29`）、前端却仍 fail-OPEN（`utils/permission.ts:10-12`），**策略相反本身就是复发温床**。
- **落地**：修 D14；新增权限码时按 HANDOVER §5.1 的五步链路全量同步（routes → menu.seed → role.seed → v-permission → catalog）。

### 原则 3｜模块说明符必须在「实际运行的每一条链路」上都可解析

- **内容**：源码里出现的每一个模块说明符，都必须在 **dev（`ts-node`）** 与 **prod（`node dist`）** 两条链路上验证可解析。改动涉及模块解析、构建、启动方式的，**两条链路都要跑一遍**才能合并。
- **防的是什么**：编译期正确 ≠ 运行期正确。P0-1 之所以能潜伏 3 天，正是因为"只跑 dev、从不跑 prod"。
- **落地**：`npm run dev:api` 与 `npm run build && npm start` 两条命令都进 CI；方案 A 若要合并，必须通过 §2.5 的 `rm -rf dist` 必测项。

### 原则 4｜任何新增的落库/落盘数据，必须同时提交清理能力

- **内容**：新增一张日志表、一个缓存目录、一类落盘文件时，**同一个 PR 内必须同时提供**：① 保留期配置；② 清理或归档接口；③ 定时执行挂载点。三者缺一不予合并。
- **防的是什么**：本项目三张日志表 + 图片缓存**全部只增不减**，其中 `sys_http_log` 在 100 QPS 下 **≈ 8.6 GB/天**（§4.2 实测推算），会在无人察觉的情况下撑爆磁盘；而"发现时已经太晚"，因为清理要分批、要停机窗口。这是典型的"事后成本远高于事前成本"。
- **落地**：§4.2 三表差异化治理；§4.3 图片缓存淘汰；清理接口自身必须进操作日志（否则形成审计黑洞）。

### 原则 5｜生产环境禁止应用自动变更数据结构

- **内容**：`NODE_ENV=production` 时禁止 `sequelize.sync()` 及任何形式的自动 DDL；所有结构变更走显式迁移脚本，且迁移脚本需可回滚。
- **防的是什么**：自动 DDL 会在无人评审、无备份确认的情况下改生产表结构，且 Sequelize 的 `sync` 对"字段类型变更/删字段"的处理可能**丢数据**，不可逆。
- **落地**：`server.ts:23` 加 `NODE_ENV` 开关（S1）；S2 引入迁移机制（`umzug` 或纯 SQL 脚本目录 + 版本表，后者零依赖，更符合项目气质）。

---

## 8. 附：devDependency 与 CI 的权衡分析与推荐

**问题**：引入测试框架 / CI 是否违反项目的"零依赖"约束？

**结论：不违反，且推荐做到「devDependency 新增量为 0」。**

| 论证                              | 说明                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 约束的原始边界是**运行时**        | 三处自研（接口文档/ZIP/codegen）的共同点是"避免引入 **runtime** 第三方包"，目标是部署简洁、供应链面小、体现自研能力。`devDependencies` 不进生产镜像（`npm ci --omit=dev`），不影响运行时行为                              |
| 现有 devDependencies 已是反例证明 | `api/package.json:30-42` 已有 `ts-node`、`tsconfig-paths`、`nodemon`、`typescript` 等 12 个 devDependency —— 项目从未禁止开发期依赖                                                                                       |
| 存在**零新增依赖**的技术路径      | Node 20.19（`package.json:43-45` engines）内置 `node:test` + `node:assert` + `node --test`，无需 vitest/jest；HTTP 断言可用 `node:http` 直接打真实端口，无需 supertest；CI 用 GitHub Actions 是纯 YAML，不占 package.json |

**推荐方案**：

```bash
# 测试：零新增依赖
node --test --experimental-test-coverage api/test/**/*.test.ts   # 需 ts-node 或先 build
# 更稳的做法：先 npm run build，对 dist 跑 node --test（与生产同形态，还能顺带验证方案 C）
```

- **测试优先级**（只测三条主线，不追求覆盖率）：
  1. `auth`：login 成功/失败/禁用账号、refresh、改密后旧 Token 失效（`middlewares/auth.ts:53-58`）
  2. `permission`：`requirePermission()` 空参 → 403、超管直通、viewer 无写码（**直接防 P0 越权复发**）
  3. `log`：清理接口留痕、脱敏一致性
- **CI 流水线（GitHub Actions，零 npm 依赖）**：`install → typecheck → lint → test → build → start 冒烟 → routeAudit diff`
- 若未来确实需要 supertest/vitest 的便利性再引入，属 devDependency 范畴，**不破坏约束**，但需在 PR 说明中写明理由。

---

## 9. 一句话总结（给决策人）

> **先花 1 小时用方案 C 打通 `npm start`（新增 1 个 60 行脚本，src 零改动，可自检），再花 3~5 人日清掉 Q1 的 11 条高影响低成本债（其中 JWT 默认密钥与登录无限频是上线前的一票否决项），然后才配谈缓存、索引、多实例这些"优化"。** 在零测试、无 CI 的 state 下做 222 处改名或大规模重构，是把"能跑"换成"跑不起来"的最快路径。

---

_本文档为只读分析产出，未修改任何源码或既有文档。所有行号对应 `master @ eb5671a`；标注 **【待实测】** 的结论（主要涉及方案 A 的 TS/tsconfig-paths 行为）需在执行前用文中给出的命令确认。_
