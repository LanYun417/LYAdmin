# 14 - Husky 与 lint-staged

## 工作原理

```txt
git commit
  └─ .husky/pre-commit → npx lint-staged
        ├─ *.{js,mjs,cjs,ts,vue}              → eslint --fix → prettier --write
        ├─ *.{json,css,scss,md,html,yml,yaml} → prettier --write
        └─ *.{css,scss,vue}                   → stylelint --fix
```

同一套钩子还挂了 `commit-msg`（提交信息校验）与 `pre-push`（依赖基线），其规则属于仓库级约定，统一见：

- 提交信息格式：[`Git 提交规范/01-提交信息规范`](../Git提交规范/01-提交信息规范.md)
- 完整校验链与绕过禁令：[`Git 提交规范/03-提交钩子与校验链`](../Git提交规范/03-提交钩子与校验链.md)

- husky 9 接管 `.git/hooks`，把 `.husky/` 下的脚本挂到对应 Git 生命周期。无需 `husky install` 手写；根 `package.json` 的 `prepare: "husky"` 在 `npm install` 时自动装配。
- lint-staged 只对暂存区文件执行检查，大仓库也能秒级完成。

## 配置文件

```bash
# .husky/pre-commit
npx lint-staged
```

```js
// lint-staged.config.cjs（节选）
module.exports = {
  '*.{js,mjs,cjs,ts,vue}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,scss,md,html,yml,yaml}': ['prettier --write'],
  '*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
};
```

> 实际配置采用函数语法：先过滤 Vditor 供应商资源、Prisma 生成客户端、自动导入声明等产物，再按 40 个文件一批执行，避免 Windows 约 32KB 的命令行长度上限。过滤范围与 `.prettierignore` / ESLint ignores 保持一致。

## 团队约定

- lint-staged 修复后会自动重新 `git add`，提交的就是修复后的代码。
- 钩子命令必须走 `npx` / `npm`，保证 Windows / macOS 行为一致。
- `package-lock.json` 必须提交入库（锁定依赖解析结果，保证团队安装一致），`dist/`、`node_modules/` 等产物不入库。
- 不绕过钩子：禁止 `--no-verify`，理由与例外流程见 [`Git 提交规范/03`](../Git提交规范/03-提交钩子与校验链.md)。

## 常见错误

| 错误                     | 原因                                                         | 解决                                                      |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| 提交时钩子不执行         | 只在 `ly-admin-web/` 或 `ly-admin-api/` 装依赖，根钩子未装配 | 在**根目录** `npm install`（触发 `prepare` → `husky`）    |
| lint-staged 卡在大量文件 | 误 add 了 dist 产物或 node_modules                           | 检查 .gitignore（package-lock.json 应提交入库，不得忽略） |
| lint-staged 报参数太长   | 单批文件数过多，超出 Windows 命令行上限                      | 配置已按 40 个一批切分；确认未关闭该适配                  |
| 钩子里 npx 找不到        | GUI 客户端环境变量缺失                                       | 用终端提交；或在 GUI 中配置 PATH                          |
| push 被 pre-push 拦截    | 运行时依赖偏离基线                                           | 见 [15-依赖守护](./15-依赖守护与版本策略.md)              |
