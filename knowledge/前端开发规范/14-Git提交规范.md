# 14 - Git 提交规范

依据：Conventional Commits 规范（https://www.conventionalcommits.org/）。提交信息由 commit-msg 钩子 + commitlint 强制校验，不合规直接拒绝提交。

## 1. 提交格式

```txt
<type>(<scope>): <subject>
                                  ← 空行
<body>
                                  ← 空行
<footer>
```

- header（首行）必填，不超过 **100** 字符（commitlint `header-max-length: 100`）。
- body 每行不超过 **100** 字符（commitlint `body-max-line-length: 100`，继承自 `@commitlint/config-conventional`）；footer 同此约束。
- body、footer 可选；写 body/footer 时与 header 之间必须空一行。

## 2. type 类型

| type       | 含义           | 何时使用                                                |
| ---------- | -------------- | ------------------------------------------------------- |
| `feat`     | 新功能         | 用户可感知的新能力                                      |
| `fix`      | 修复缺陷       | 修 bug                                                  |
| `docs`     | 文档变更       | 只改文档（含 `knowledge/` 知识库）                      |
| `style`    | 代码格式       | 缩进、分号等，**不改逻辑**                              |
| `refactor` | 重构           | 既非新功能也非修 bug 的代码调整                         |
| `perf`     | 性能优化       | 以性能为目的的改动                                      |
| `test`     | 测试           | 新增/修改测试                                           |
| `build`    | 构建系统或依赖 | vite 配置、package.json 依赖变更（注意依赖守护，见 16） |
| `ci`       | CI 配置        | 流水线                                                  |
| `chore`    | 杂项           | 不属于以上任何一类                                      |
| `revert`   | 回滚           | 回滚某次提交                                            |
| `wip`      | 进行中         | 本仓库额外允许的临时提交类型                            |
| `workflow` | 工作流         | 流程/脚本调整                                           |
| `types`    | 类型           | 仅类型变更                                              |
| `release`  | 发版           | 版本发布相关                                            |

> 类型清单由 `commitlint.config.cjs` 的 `type-enum` 预置；`wip` / `workflow` / `types` / `release` 为本仓库在通用集之上的扩展。

## 3. scope 范围

团队统一词表（可扩展）：`user` `router` `store` `api` `ui` `config` `deps` `style` `build` 等，表示改动影响的模块；影响面很广时可省略。scope 用英文小写。

> 提交可针对 `ly-admin-web/`（前端）或 `ly-admin-api/`（后端），scope 通常与模块对应，例如 `feat(user):`、`fix(api):`。

## 4. subject 写法

- **统一使用中文**（中英二选一，本项目定为中文）。
- 祈使句、简短精炼，如「新增订单导出功能」。
- 结尾**不加句号**（commitlint `subject-full-stop` 未强制但风格一致；注意 header 不超 100 字符）。
- 关闭大小写校验（`subject-case: [0]`）以兼容中文。

## 5. 破坏性变更

footer 中以 `BREAKING CHANGE:` 开头，说明破坏了什么、如何迁移；header 可加 `!` 强调。

```txt
feat(api)!: 请求统一返回 ApiResponse 结构

BREAKING CHANGE: request 封装返回值由 AxiosResponse 改为解包后的 ApiResponse<T>，
调用方需删除所有 .data 访问。
```

## 6. 关联 issue

```txt
fix(user): 修复登录过期后未跳转的问题

Closes #123
```

## 7. 正确 vs 错误示例

| 判定 | 提交信息                                    | 说明                             |
| ---- | ------------------------------------------- | -------------------------------- |
| ✅   | `feat(user): 新增用户头像上传`              | 完整 type + scope + subject      |
| ✅   | `fix(api): 修复守卫重复跳转`                |                                  |
| ✅   | `docs: 补充自动导入章节 FAQ`                | scope 可省略                     |
| ✅   | `refactor(ui): 抽取 OrderListView 复用组件` |                                  |
| ✅   | `chore(deps): 更新依赖基线`                 | 依赖变更（配合 deps-guard）      |
| ❌   | `update`                                    | 无 type                          |
| ❌   | `fix: 修bug。`                              | subject 带句号（风格）/ 无信息量 |
| ❌   | `Feat(user): 新增功能`                      | type 必须小写                    |
| ❌   | `feat: 改动了很多东西`                      | 描述无信息量                     |
| ❌   | `新增订单页`                                | 缺 type                          |

## 8. 分支模型

| 分支        | 职责             | 规则                                        |
| ----------- | ---------------- | ------------------------------------------- |
| `master`    | 主分支（受保护） | 生产代码；本仓库以 `master` 为默认保护分支  |
| `feature/*` | 功能分支         | 从 `master` 切出，如 `feature/order-export` |
| `fix/*`     | 修复分支         | 从 `master` 切出                            |
| `hotfix/*`  | 紧急修复         | 从 `master` 切出，修完合回 `master`         |

> 本仓库采用 `master` 为主分支（非 `main`）；发布/合并策略按团队实际约定，受保护分支禁止直接 push。

## 9. 交互式提交

```bash
git add -A
npm run commit    # cz-git 引导选择 type → scope → subject → body → breaking
```

## 10. 校验链

```txt
git commit
  ├─ pre-commit → lint-staged（eslint --fix + prettier --write + stylelint --fix 暂存文件）
  └─ commit-msg → commitlint（格式校验，不合规则拒绝）
  └─ pre-push  → guard:deps（依赖基线校验）
```

> 注意：本项目还有 `pre-push` 钩子执行 `npm run guard:deps`，推送前会校验运行时依赖基线（见 16）。
