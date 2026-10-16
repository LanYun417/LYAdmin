# 15 - Husky 与 lint-staged

## 工作原理

```
git commit
  ├─ .husky/pre-commit  → npx lint-staged
  │     ├─ *.{js,mjs,cjs,ts,vue}   → eslint --fix → prettier --write
  │     ├─ *.{json,css,scss,md,html,yml,yaml} → prettier --write
  │     └─ *.{css,scss,vue}        → stylelint --fix --allow-empty-input
  └─ .husky/commit-msg  → npx --no -- commitlint --edit "$1"
  └─ .husky/pre-push    → npm run guard:deps
```

- husky 9 接管 `.git/hooks`，把 `.husky/` 下的脚本挂到对应 Git 生命周期。无需 `husky install` 手写；根 `package.json` 的 `prepare: "husky"` 在 `npm install` 时自动装配。
- lint-staged：只对暂存区文件执行检查，大仓库也能秒级完成。

## 配置文件

```bash
# .husky/pre-commit
npx lint-staged
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

```bash
# .husky/pre-push
npm run guard:deps
```

```js
// lint-staged.config.cjs
module.exports = {
  '*.{js,mjs,cjs,ts,vue}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,scss,md,html,yml,yaml}': ['prettier --write'],
  '*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
};
```

> 注意 `commit-msg` 用 `npx --no -- commitlint`：避免 npm 脚本把 `--edit` 当作 npm 参数解析；Windows 上保持脚本为简单命令、参数用 `"$1"`。

## 团队约定

- 禁止 `--no-verify` 绕过钩子。钩子失败先修问题；确属误报在团队群同步后调整配置。
- lint-staged 修复后会自动重新 `git add`，提交的就是修复后的代码。
- 钩子命令必须走 `npx` / `npm`，保证 Windows / macOS 行为一致。
- `package-lock.json` 必须提交入库（锁定依赖解析结果，保证团队安装一致），`dist/`、`node_modules/` 等产物不入库。

## 常见错误

| 错误                             | 原因                                                         | 解决                                                      |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 提交时钩子不执行                 | 只在 `ly-admin-web/` 或 `ly-admin-api/` 装依赖，根钩子未装配 | 在**根目录** `npm install`（触发 `prepare` → `husky`）    |
| Windows 上 commit-msg 报路径错误 | 用了 bash 特有语法                                           | 保持脚本为简单命令，参数用 `"$1"`                         |
| lint-staged 卡在大量文件         | 误 add 了 dist 产物或 node_modules                           | 检查 .gitignore（package-lock.json 应提交入库，不得忽略） |
| 钩子里 npx 找不到                | GUI 客户端环境变量缺失                                       | 用终端提交；或在 GUI 中配置 PATH                          |
| push 被 pre-push 拦截            | 运行时依赖偏离基线                                           | 见 16 依赖守护；确需变更走 `guard:deps -- --update`       |
