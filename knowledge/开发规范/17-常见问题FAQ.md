# 17 - 常见问题 FAQ

## 环境 / 安装类

**Q1：npm install 报引擎不满足？**
Node 版本低于 `engines` 要求的 `>=20.19.0`。`node -v` 核对；本机为 24.x 通常满足。开发机只需 >=20.19.0，不要求固定 24。

**Q2：安装缓慢或超时？**
确认根 `.npmrc` 指向 npmmirror 镜像（`registry=https://registry.npmmirror.com`）；公司网络按需在 `.npmrc` 追加配置。

**Q3：提交时 husky 钩子不执行？**
在**根目录**执行 `npm install`（会触发 `prepare` → `husky`）。只在 `admin/` 或 `api/` 装依赖不会装配根钩子。确认 `.husky/` 下存在 `pre-commit` / `commit-msg` / `pre-push`。

**Q4：push 被 pre-push 拦截（deps-guard）？**
运行时依赖偏离基线（见 16）。确需变更走 `npm run guard:deps -- --update` 更新基线并在评审说明。

## 自动导入类

**Q5：运行时 `ref is not defined`？**
插件没生效：确认 `vite.config.ts` 中 `AutoImport` 已注册且在 `vue()` 之后；重启 `npm run dev`。

**Q6：TS 报 `Cannot find name 'ElMessage'`？**
`ElMessage` 不自动导入，应从 `@/utils/element` 引入（见 06/09）。`ref` 等报找不到则确认 `auto-imports.d.ts` 已生成且 `tsconfig.json` 的 `include` 覆盖它（跑一次 dev 即可生成）。

**Q7：ESLint 报 `no-undef`？**
本项目对 TS 文件关闭了 `no-undef`（类型正确性由 `vue-tsc`/`tsc` 负责）。若仍报，检查 `eslint.config.mjs` 是否被改动；不要在配置里手动加 auto-import globals。

**Q8：Element Plus 组件无样式 / 首屏体积暴涨？**
命令式 API 误用 `from 'element-plus'` 整库引入 → 改为 `@/utils/element`；组件样式交给 `ElementPlusResolver`，不要手动 `app.use(ElementPlus)`。

## 样式类

**Q9：Element Plus 按钮背景透明 / 样式错乱？**
Tailwind preflight 已关闭（`corePlugins.preflight: false`）。若 border 类不可见或渲染黑线，确认 `src/styles/index.css` 的 `@layer base` 中 border 重置未被删除。

**Q10：Tailwind 工具类不生效？**
检查 `tailwind.config.js` 的 `content` 覆盖到 `.vue`；改了 `tailwind.config.js` 或 `theme` 映射后**需重启 dev server**（配置变更不热更新）。

**Q11：用了 `shadow-[var(--el-...)]` 阴影不显示？**
Tailwind 会把 `var()` 当阴影颜色，导致 box-shadow 不生成。改用 `theme.boxShadow` 里定义的 `shadow-el-light`（见 10）。

## Git 类

**Q12：提交被拒：subject may not be empty / type may not be empty？**
提交信息不符合 Conventional Commits。用 `npm run commit` 交互式生成，或按 `type(scope): subject` 手写。

**Q13：能否用 `git commit --no-verify` 紧急绕过？**
禁止。确有误报在团队群同步后调整配置，不留后门。

## 构建 / 运行类

**Q14：构建后 `@` 别名报错？**
vite alias 与 tsconfig paths 不一致，双端对齐 `@` → `./src`。

**Q15：生产环境刷新 404？**
history 模式需服务端回退。同源部署由后端托管 `api/web` 并回退 `index.html`；分离部署 Nginx `try_files $uri $uri/ /index.html;`。

**Q16：登录成功但菜单为空？**
菜单由后端按角色下发。空说明种子未写入，`cd api && npm run seed`（幂等）；普通角色在「角色管理 → 菜单授权」勾选。

**Q17：端口被占用（3000 / 5173）？**
`vite.config.ts` 为 `strictPort: true`，端口占用直接报错。后端改 `api/.env` 的 `PORT`，前端改 `VITE_PORT` 并同步 `vite.config.ts` 的 proxy `target`。
