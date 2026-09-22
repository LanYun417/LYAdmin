# 蓝云后台管理系统（LYAdmin）· Git 提交规范

> 版本：v1.0 ｜ 维护：架构师 高见远（Gao）
> 关联文档：[`docs/CODE-STYLE.md`](./CODE-STYLE.md)（代码规范）、[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)（架构设计）
> 本文规则以仓库真实配置为准：`commitlint.config.cjs`、`.czrc`、`lint-staged.config.cjs`、`.husky/pre-commit`、`.husky/commit-msg`。

---

## 1. 分支策略

| 分支        | 定位                        | 从哪切出 | 合回哪             | 命名示例                    |
| ----------- | --------------------------- | -------- | ------------------ | --------------------------- |
| `master`    | 生产 / 稳定分支（当前主干） | —        | —                  | `master`                    |
| `dev`       | 开发集成分支                | `master` | `master`（发版时） | `dev`                       |
| `feature/*` | 新功能开发                  | `dev`    | `dev`              | `feature/user-management`   |
| `fix/*`     | 一般缺陷修复                | `dev`    | `dev`              | `fix/login-token-refresh`   |
| `hotfix/*`  | 线上紧急修复                | `master` | `master` + `dev`   | `hotfix/timezone-8h-offset` |

**约定**：

- 分支名统一 **kebab-case**，全小写，`/` 后为简短英文描述（对应模块/问题）。
- 一个分支只做一件事；功能完成、CI/自测通过后再合并。
- `hotfix/*` 合并后必须**同步回合 `dev`**，避免修复丢失。
- 禁止在 `master` 直接提交业务代码；当前项目以本地开发为主，主干为 `master`。

---

## 2. 提交信息格式

采用 **Conventional Commits**，格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

- 由 `commitlint`（`@commitlint/config-conventional`）在 `commit-msg` 钩子校验。
- `header-max-length` = **100**；`subject-case` 已关闭（不强制大小写）。

### 2.1 完整字段说明表

| 字段      | 必填 | 说明                                                         |
| --------- | ---- | ------------------------------------------------------------ |
| `type`    | 是   | 变更类型，取值见 2.2 表                                      |
| `scope`   | 否   | 影响范围，取值见 2.3 表；可省略                              |
| `subject` | 是   | 简短描述，写法见 2.4                                         |
| `body`    | 否   | 详细说明「为什么改 / 怎么改」，与 header 空一行              |
| `footer`  | 否   | 关联 issue（`Closes #12`）或破坏性变更（`BREAKING CHANGE:`） |

### 2.2 type 取值表

> `commitlint.config.cjs` 的 `type-enum` 在 Conventional 11 类基础上额外放行了 `wip / workflow / types / release`。

| type       | 中文含义               | 适用场景                                 |
| ---------- | ---------------------- | ---------------------------------------- |
| `feat`     | 新增功能               | 新增用户管理页、新增导出接口             |
| `fix`      | 修复缺陷               | 修复时区 8 小时偏差、修复 401 刷新死循环 |
| `docs`     | 文档变更               | 修改 README、补充 CODE-STYLE             |
| `style`    | 代码格式（不影响功能） | 格式化、调整缩进、补分号                 |
| `refactor` | 重构（非新增非修复）   | 抽取 `useTable`、拆分 Service            |
| `perf`     | 性能优化               | 优化仪表盘聚合查询、减少重复请求         |
| `test`     | 测试相关               | 新增/修改测试用例                        |
| `build`    | 构建系统或依赖变更     | 升级 Vite、调整 `vite.config.ts`         |
| `ci`       | CI 配置变更            | 调整流水线配置                           |
| `chore`    | 其他杂项               | 改 `.gitignore`、调整脚本                |
| `revert`   | 回退提交               | 撤销某次提交                             |
| `wip`      | 进行中（临时）         | 未完成的阶段性提交（**不合并前应压缩**） |
| `workflow` | 工作流变更             | 调整协作流程相关配置                     |
| `types`    | 类型定义变更           | 仅改 `.d.ts` / 类型声明                  |
| `release`  | 发布相关               | 版本号、发布记录                         |

### 2.3 scope 取值表（`.czrc` 的 `scopes`）

| scope     | 含义           |
| --------- | -------------- |
| `root`    | 根目录工程规范 |
| `api`     | 后端 `api/`    |
| `admin`   | 前端 `admin/`  |
| `docs`    | `docs/` 文档   |
| `config`  | 各类配置文件   |
| `deps`    | 依赖升级       |
| `release` | 发布           |

- `enableMultipleScopes: true`：支持多 scope，用**英文逗号**分隔（`scopeEnumSeparator: ','`），如 `feat(api,admin): ...`。
- `allowCustomScopes: true`：允许自定义 scope；`allowEmptyScopes: true`：可省略 scope。

### 2.4 subject 规范

- 使用**简体中文**，**动词开头**（新增 / 修复 / 优化 / 调整 / 补充 / 删除…）。
- **不超过 50 字符**（整个 header ≤ 100）；`subjectLimit: 100`。
- **结尾不加句号**，使用**祈使语气**（「修复时区偏差」而非「修复了时区偏差。」）。
- 不与 type 语义重复（❌ `fix: 修复修复登录问题`）。

### 2.5 body 与 footer 写法要点

- **body**：与 header 之间**空一行**；用 `-` 列表分条描述「改了什么 / 为什么改 / 影响范围」；每行建议 ≤ 72 字符便于阅读。
- **footer**：
  - 关联 issue：`Closes #28`（自动关闭）、`Refs #30`（仅引用）。
  - 破坏性变更：`BREAKING CHANGE: <说明>`，必须**大写**、出现在 footer 区，会触发主版本号变更。
- 一次提交若涉及多个关注点，优先**拆分提交**而非在 body 里堆叠（见第 7 节）。

### 2.6 提交信息速查模板

```
# 最小可用
<type>(<scope>): <中文动词开头的描述>

# 带正文与关联 issue
<type>(<scope>): <描述>

- 要点一
- 要点二

Closes #<issue>

# 破坏性变更
<type>(<scope>): <描述>

BREAKING CHANGE: <不兼容点与迁移方式>
```

---

## 3. 正反例对照

| #   | ✅ 推荐写法                                            | ❌ 反面写法                                                    | 问题                           |
| --- | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------ |
| 1   | `feat(admin): 新增用户管理页`                          | `新增用户管理页`                                               | 缺 type/scope，commitlint 拒绝 |
| 2   | `fix(api): 修复 col 在 raw 查询下未映射列名`           | `fix: 修复 bug`                                                | subject 含糊，无法定位         |
| 3   | `fix(api): 修复数据库时间字段跨时区比较偏差 8 小时`    | `fix(api): 修复了时区问题。`                                   | 句号结尾 + 非动词开头          |
| 4   | `refactor(admin): 抽取用户列表分页通用逻辑到 useTable` | `refactor: 一堆改动`                                           | 无 scope、描述笼统             |
| 5   | `chore(deps): 升级 element-plus 至 2.14.6`             | `update package.json`                                          | 缺 type、英文、无规范          |
| 6   | `docs(root): 补充代码规范与提交规范文档`               | `docs: 更新文档`                                               | 未说明更新内容                 |
| 7   | `feat(api): 新增操作日志导出 CSV 接口`                 | `feat: add export api and fix login and update ui`             | 一次提交多件事、中英混杂       |
| 8   | `fix(admin): 修复登录后菜单为空的问题`                 | `fix(admin): 修复菜单为空的问题，顺便重构了 store，还改了样式` | 提交粒度过大                   |
| 9   | `build(root): 锁定 prettier 打印宽度为 120`            | `build: 改配置`                                                | 未说明具体配置项               |
| 10  | `revert: 回退 feat(admin): 新增用户管理页`             | `revert it`                                                    | 缺 type、无回退对象            |

---

## 4. 完整提交示例

### 4.1 含 body 与 footer（关联 issue）

```
feat(api,admin): 新增文件上传与管理模块

- 后端新增 multer 磁盘存储中间件，支持 1~10 个文件、类型与大小白名单
- 文件落库 sys_file，静态资源经 /uploads 暴露
- 前端新增上传管理页，支持列表、删除与预览

Closes #28
```

### 4.2 含 BREAKING CHANGE

```
refactor(api): 统一响应体为 code/message/data

BREAKING CHANGE: 原响应体 { success, result } 已废弃，前端 request.ts
拦截器需同步改为按 code === 200 解包，所有旧接口调用方需适配。
```

> `BREAKING CHANGE:` 必须**大写**且出现在 footer；会触发语义化版本主版本号变更。

### 4.3 多 scope

```
chore(admin,deps): 升级 vue-router 至 5.3.1 并适配路由类型
```

---

## 5. 提交前钩子（husky）

| 钩子         | 文件                | 实际内容                             | 作用                                             |
| ------------ | ------------------- | ------------------------------------ | ------------------------------------------------ |
| `pre-commit` | `.husky/pre-commit` | `npx lint-staged`                    | 对**暂存区文件**跑 lint/format，不通过则中止提交 |
| `commit-msg` | `.husky/commit-msg` | `npx --no -- commitlint --edit "$1"` | 校验提交信息是否符合 Conventional Commits        |

**`pre-commit` 中 lint-staged 实际做了什么**（`lint-staged.config.cjs`）：

- `*.{js,mjs,cjs,ts,vue}` → `eslint --fix` + `prettier --write`
- `*.{json,css,scss,md,html,yml,yaml}` → `prettier --write`
- `*.{css,scss,vue}` → `stylelint --fix --allow-empty-input`

**校验失败怎么修**：

| 失败钩子     | 现象                                                 | 解决办法                                                                                                |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pre-commit` | ESLint/Prettier/Stylelint 报错，提交被拒             | 按报错修复后 `git add` 再提交；或本地先跑 `npm run lint:fix`、`npm run format`、`npm run stylelint:fix` |
| `commit-msg` | `subject may not be empty` / `type may not be empty` | 用 `npm run commit` 重新生成规范信息                                                                    |
| `commit-msg` | `type must be one of [...]`                          | type 不在枚举内，改用第 2.2 表内的 type                                                                 |
| `commit-msg` | `header must not be longer than 100 characters`      | 精简 subject，控制 header ≤ 100 字符                                                                    |

> 如确需跳过钩子（**不推荐**）：`git commit --no-verify`。仅限紧急场景，且应在后续提交中补齐规范。

---

## 6. 交互式提交（cz-git）

推荐统一用交互式提交，避免手写格式错误：

```bash
npm run commit      # 等价于 npx cz（cz-git 适配器）
```

交互流程：选择 **type** → 选择/输入 **scope**（可多选，逗号分隔）→ 填写 **subject** → 可选 **body** → 可选 **breaking** → 选择关联 **issue 前缀** → 确认提交。

- 配置见 `.czrc`（中文提示文案、scope 列表、`useEmoji: false`）。
- 适配器注册在根 `package.json` 的 `config.commitizen.path = "node_modules/cz-git"`。

---

## 7. 提交粒度原则

1. **一个提交只做一件事**：功能、修复、重构、文档、依赖升级**分开提交**。
2. **何时该拆分**：
   - 同时改了 `api/` 与 `admin/` 且属于两个独立功能 → 拆成 `feat(api)` 与 `feat(admin)`（除非是同一功能的端到端实现，可用多 scope 合并）。
   - 夹带了无关的格式化/重命名 → 拆出独立 `style` 提交。
3. **禁止巨型提交**：单个提交 diff 建议 ≤ 400 行；`wip` 提交必须在合并前用 rebase 压缩（squash）。
4. **每个提交应可独立构建**：避免提交中间态导致 `npm run typecheck` 失败。

---

## 8. 版本与发布标签

- 版本号遵循 **语义化版本 SemVer**（`MAJOR.MINOR.PATCH`）：
  - `MAJOR`：含 `BREAKING CHANGE` 的不兼容变更；
  - `MINOR`：向后兼容的新功能（`feat`）；
  - `PATCH`：向后兼容的缺陷修复（`fix`）。
- 发布时打**附注标签**（推荐）并推送：

```bash
git tag -a v1.0.0 -m "release: v1.0.0 首个可用版本"
git push origin v1.0.0
```

- 与提交规范的映射：`feat` → MINOR，`fix` → PATCH，`BREAKING CHANGE` → MAJOR；`docs`/`style`/`chore` 等不影响版本号。
- 发布相关的提交建议使用 `release` 类型与 scope，如 `release(root): v1.1.0`。

---

## 9. 常见错误排查

| #   | 报错 / 现象                                     | 原因                      | 解决办法                                                                              |
| --- | ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `type must be one of [feat, fix, ...]`          | type 不在 `type-enum` 内  | 改用第 2.2 表中的合法 type（注意本仓额外支持 `wip/workflow/types/release`）           |
| 2   | `header must not be longer than 100 characters` | header 超长               | 精简 subject，header 控制在 100 字符内                                                |
| 3   | 提交时钩子完全不执行                            | husky 未安装 / 未初始化   | 在**根目录**执行 `npm install`（触发 `prepare` → `husky`），确认 `.husky/` 下钩子存在 |
| 4   | `command not found: lint-staged` / `commitlint` | 未在根目录安装依赖        | 在根目录 `npm install`，不要只装 `admin/` 或 `api/`                                   |
| 5   | `pre-commit` 反复报 Prettier 格式错误           | 编辑后未重新 `git add`    | lint-staged 只处理暂存内容，修复后必须重新 `git add`                                  |
| 6   | `subject may not be empty`                      | `type(scope):` 后没有描述 | 补上 subject，或用 `npm run commit` 交互生成                                          |
| 7   | 中文提交信息乱码                                | 终端编码非 UTF-8          | 将终端/编辑器设为 UTF-8，`.editorconfig` 已统一 `charset = utf-8`                     |

---

## 附：相关文档

- 代码规范：[`docs/CODE-STYLE.md`](./CODE-STYLE.md)
- 系统架构与统一约定：[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- 项目总览：[`../README.md`](../README.md)
