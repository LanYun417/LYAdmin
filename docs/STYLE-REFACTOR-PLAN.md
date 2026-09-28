# LYAdmin 前端样式规范符合性审查与 Tailwind 迁移方案

> 生成日期：2026-09-28 ｜ 范围：`admin/src` 全部样式（2 个全局样式文件 + 28 个组件的 `<style scoped>`）
> 依据：[`docs/CODE-STYLE.md`](./CODE-STYLE.md) §3.5「Tailwind 原子类优先」、§3.2 组件划分、§3.3 状态管理
> 结论仅覆盖**样式迁移**，不改变任何业务逻辑。

---

## 0. 结论摘要

**项目并未大面积违反「Tailwind 优先」**：模板中已广泛使用 Tailwind（约 27 个文件），28 个 scoped 样式块里**大多数只有 3~8 行**，属规范 §3.5 明确允许的「少量与组件强相关的静态样式」。

但仍有三类**确定的优化空间**：

| 类别         | 说明                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 重复代码   | `.table-title` 在 7 处逐字重复（6 个列表页 + gen）；3 个错误页几乎相同；`IconSelect` 与 `IconPicker` 几乎相同；`.chart` 尺寸在 3 个图表组件重复 |
| ② 可直接迁移 | 纯布局 / 间距 / 字号 / 语义色，可被 Tailwind 完全表达（如 `.chart{width:100%;height:300px}`、导航与侧边栏布局）                                 |
| ③ 与 TW 重复 | 全局自定义工具类 `.text-ellipsis` ≡ `truncate`、`.full-height` ≡ `h-full`                                                                       |

**必须保留 CSS**：`styles/element.scss`（EP 覆盖）、`views/login/index.vue`（复杂视觉）、Vue 过渡类名、主题切换过渡、layout 抽屉动画、`@layer base` 重置。

**迁移前置改造（重要）**：`tailwind.config.js` 目前只映射了 `primary`，需补映射 Element Plus 的语义色变量（文字 / 背景 / 边框）。否则颜色要写成 `text-[color:var(--el-text-color-secondary)]`，**可读性反而低于原 CSS**，迁移得不偿失。

> **执行状态（2026-09-28）**：**P0 批次已完成并推送** —— `d43a793`（tailwind 语义色映射）、`eb92f32`（消除 `.table-title` 重复、删除冗余工具类、迁移图表容器样式）。§5 的 P1 / P2 待办；§2 / §3 保留审查结论，作为 P1 的执行依据。

---

## 1. 现状盘点

### 1.1 全局样式文件（2）

| 文件                  | 内容                                                                                                     | 判定                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `styles/index.css`    | Tailwind 三指令 + `@layer base` 最小重置 + 自定义工具类（现仅 `.flex-center`）+ 主题切换过渡 + NProgress | **保留**；其中 `.text-ellipsis`/`.full-height` 建议废弃改用 `truncate`/`h-full`（见 §3） |
| `styles/element.scss` | Element Plus 覆盖（侧边栏菜单、表格、卡片、搜索区）                                                      | **必须保留**（规范 §3.5 要求 EP 覆盖写在此处、带命名空间，不可用 Tailwind 替代）         |

> `@layer base` 的最小重置**不可迁移**：项目关闭了 Tailwind `preflight`，该 `@layer base` 正是用来补齐必要重置的（规范 §3.5 明确要求）。

### 1.2 组件 `<style scoped>`（28 个文件）

按可迁移程度分为 A / B / C 三类，详见 §2。

---

## 2. 分级清单

### A 类 · 建议迁移到 Tailwind（纯静态样式，零风险）

| #   | 文件                                                    | 样式内容与用途                                        | 迁移写法示例                                                                                              |
| --- | ------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `views/home/components/BarChart.vue` :109               | `.chart` 图表容器尺寸                                 | `class="w-full h-[300px]"` → **可整块删除**                                                               |
| 2   | `views/home/components/PieChart.vue` :134               | 同上                                                  | 同上                                                                                                      |
| 3   | `views/home/components/TrendChart.vue` :113             | 同上                                                  | 同上                                                                                                      |
| 4   | `views/home/index.vue` :138                             | `.home-hero/.home-greeting/.home-subtitle` 首页问候区 | `mb-4` / `text-xl font-bold text-ink` / `mt-1.5 text-[13px] text-muted`                                   |
| 5   | `views/home/components/StatCard.vue` :43                | 统计卡片 + hover 抬升 + 数值排版                      | `p-5 rounded-[10px] border transition hover:-translate-y-0.5 hover:shadow-md` + `tabular-nums`            |
| 6   | `layout/components/Navbar/index.vue` :41                | 顶栏高度 / 内边距 / 下边框 / 折叠按钮                 | `h-[50px] px-4 border-b border-line-light` / `text-lg cursor-pointer`                                     |
| 7   | `layout/components/Navbar/Avatar.vue` :126              | 主题切换图标 / 颜色选择器 / 用户名                    | `text-lg cursor-pointer` / `inline-flex items-center` / `text-sm text-ink`                                |
| 8   | `layout/components/Sidebar/index.vue` :42               | 侧边栏溢出控制                                        | `overflow-hidden` / `h-full`                                                                              |
| 9   | `layout/components/Sidebar/Logo.vue` :21                | Logo 区高度 / 下边框 / 标题                           | `h-[50px] overflow-hidden border-b` / `ml-2 text-base font-semibold whitespace-nowrap`                    |
| 10  | `components/IconPicker/index.vue` :99                   | 图标选择网格 / 单元格 / 悬停 / 计数提示               | `gap-1` / `w-10 h-10 border rounded cursor-pointer` + 条件类控制 active                                   |
| 11  | `views/system/menu/components/IconSelect.vue` :110      | 同 IconPicker（尺寸略异：42px）                       | 同上                                                                                                      |
| 12  | `views/system/role/components/PermissionDrawer.vue` :92 | 权限抽屉滚动容器                                      | `h-full overflow-auto`                                                                                    |
| 13  | `views/profile/index.vue` :102                          | 头像区 / 昵称 / 用户名                                | `py-2` / `mt-3 text-base font-semibold text-ink` / `text-[13px] text-muted`                               |
| 14  | `views/error/403.vue` :24                               | 错误页（容器 / 居中 / 大号状态码 / 文案）             | `w-full h-full` / `text-center` / `text-[96px] font-bold text-primary` / `mt-3 mb-6 text-base text-muted` |
| 15  | `views/error/404.vue` :24                               | 同上                                                  | 同上                                                                                                      |
| 16  | `views/error/500.vue` :24                               | 同上                                                  | 同上（`text-danger`）                                                                                     |
| 17  | `views/system/user/index.vue` :260                      | `.table-title` 列表标题                               | `text-[15px] font-semibold text-ink`                                                                      |
| 18  | `views/system/menu/index.vue` :149                      | 同上                                                  | 同上                                                                                                      |
| 19  | `views/system/role/index.vue` :167                      | 同上                                                  | 同上                                                                                                      |
| 20  | `views/log/login/index.vue` :153                        | 同上                                                  | 同上                                                                                                      |
| 21  | `views/log/operation/index.vue` :188                    | 同上                                                  | 同上                                                                                                      |
| 22  | `views/log/http/index.vue` :204（第 1 个 style 块）     | 同上                                                  | 同上                                                                                                      |

> 第 17~22 项是**逐字完全相同**的 `.table-title`（7 份，含 gen），见 §3 重复治理建议。

### B 类 · 部分可迁移（静态样式可迁，特殊部分必须保留）

| #   | 文件                                                | 可迁移                                                     | **必须保留**                                                                         |
| --- | --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 23  | `layout/components/AppMain.vue` :25                 | `.app-main` 的内边距与两处媒体查询                         | `.fade-transform-*` 路由过渡类名（Vue `<Transition>` 约定）                          |
| 24  | `layout/components/TagsView/index.vue` :151         | `.tags-view/.tags-scroll/.tags-wrap/.tags-item` 与右键菜单 | `.tag-move/.tag-enter-*/.tag-leave-*`（`<TransitionGroup>` 类名，不可替代）          |
| 25  | `views/tool/gen/index.vue` :493                     | 主体 flex 布局与卡片样式                                   | `.gen-preview*` 的弹窗布局（含媒体查询）；`@media (width >= 1024px)` 断点            |
| 26  | `views/upload/index.vue` :211                       | `.upload-icon` / `.file-thumb--image`                      | `.file-thumb .file-thumb-placeholder` 后代选择器（Tailwind 需 `[&_.x]:` 反而更晦涩） |
| 27  | `views/log/http/index.vue` :212（第 2 个 style 块） | `.detail-title`                                            | `.detail-block pre`（作用于 `el-table` 展开行内的 `pre`，属后代选择器）              |

### C 类 · 必须保留原生 CSS / SCSS（不可迁移）

| #   | 文件                                       | 原因                                                                                                                                                                                 |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 28  | `views/login/index.vue` :157               | 品牌式布局：`radial-gradient` 光斑、网格背景、`mask-image`、`color-mix()`、`filter: blur`、`@media` 双栏切换、`html.dark` 覆盖。Tailwind 表达这些会极度晦涩，**保留 CSS 是正确选择** |
| 29  | `layout/index.vue` :71                     | 布局骨架可用 Tailwind，但抽屉动画（`transform + visibility` 延迟）、`.el-backtop` 覆盖、`fade-*` 过渡类名必须保留                                                                    |
| 30  | `styles/element.scss` / `styles/index.css` | EP 组件覆盖 + base 重置 + 主题过渡 + 第三方（NProgress）覆盖                                                                                                                         |

> 说明：`layout/index.vue` 中的 `.el-backtop:hover` 属「覆盖 EP 组件内部样式」，按规范应带命名空间或收敛到 `element.scss`，建议一并归位。

---

## 3. 重复代码治理（收益最高的低垂果实）

| 重复项                                | 出现位置                                                         | 建议                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.table-title`（7 份逐字相同）        | user / menu / role / log-login / log-operation / log-http 与 gen | **二选一**：① 统一改用 Tailwind `text-[15px] font-semibold text-ink`；② 抽为 `index.css` 的 `@layer components` 单一类（推荐 ①，减少全局命名） |
| 3 个错误页                            | `views/error/{403,404,500}.vue`                                  | 抽为公共组件（如 `components/ErrorPage.vue`，用 props 传状态码与颜色），删除 3 份样式                                                          |
| `IconSelect` / `IconPicker`           | `views/system/menu/components/`、`components/`                   | 二者逻辑与样式高度重复，建议合并为一个公共组件                                                                                                 |
| `.chart { width:100%; height:300px }` | 3 个图表组件                                                     | 改用 `w-full h-[300px]`，删除样式块                                                                                                            |
| `.text-ellipsis` / `.full-height`     | `index.css` 定义，**全项目零引用（死代码）**                     | 与 Tailwind `truncate` / `h-full` 等价，**建议废弃并全局替换**                                                                                 |
| `.flex-center`                        | `index.css` 定义                                                 | Tailwind 无单类等价，可保留（或改 `@layer components` 明确其为项目级复用类）                                                                   |

---

## 4. 前置改造：扩展 `tailwind.config.js` 的 EP 语义色映射

**这是批量迁移的前提。** 目前仅映射了 `primary`，其余样式只能写 `text-[color:var(--el-text-color-secondary)]` 这类长 arbitrary value，可读性差。建议补映射（命名与 Element Plus 语义一一对应）：

```js
theme: {
  extend: {
    colors: {
      primary: 'var(--el-color-primary)',
      success: 'var(--el-color-success)',
      warning: 'var(--el-color-warning)',
      danger: 'var(--el-color-danger)',
      info: 'var(--el-color-info)',
      // 背景
      surface: 'var(--el-bg-color)',
      page: 'var(--el-bg-color-page)',
      overlay: 'var(--el-bg-color-overlay)',
      'fill-light': 'var(--el-fill-color-light)',
      // 文字
      ink: 'var(--el-text-color-primary)',
      'ink-regular': 'var(--el-text-color-regular)',
      muted: 'var(--el-text-color-secondary)',
      faint: 'var(--el-text-color-placeholder)',
      // 边框
      line: 'var(--el-border-color)',
      'line-light': 'var(--el-border-color-light)',
      'line-lighter': 'var(--el-border-color-lighter)',
    },
  },
},
```

迁移后写法即变为 `text-muted`、`bg-surface`、`border-line-light`，**比原 CSS 更短且自带暗黑适配**（因为指向的是 EP 变量）。

> 注意：新增色名需同步进本文件的命名约定，避免团队出现多套叫法（如 `text-secondary` vs `muted`）。

---

## 5. 优先级与批次建议

| 批次           | 内容                                                                                                                | 风险 | 收益                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------ |
| **P0（先做）** | ① 扩展 `tailwind.config` 色映射；② 废弃 `.text-ellipsis`/`.full-height`；③ 抽取 `.table-title`；④ 3 个图表 `.chart` | 极低 | 消除重复、建立迁移词汇表 |
| **P1（批量）** | A 类第 4~16、23 项：error / home / StatCard / Navbar / Sidebar / Logo / IconPicker / IconSelect / PermissionDrawer  | 低   | 覆盖绝大多数「可迁尽迁」 |
| **P2（谨慎）** | B 类的 25~27（gen / upload / http-detail）；错误页组件化、IconPicker 合并                                           | 中   | 结构性改善               |
| **明确不做**   | `login/index.vue`、`element.scss`、所有过渡类名、主题过渡、`@layer base` 重置、layout 抽屉动画                      | —    | 这些保留 CSS 更规范      |

---

## 6. 迁移红线（不可用 Tailwind 替代）

1. **Vue 过渡类名**：`fade-*`、`fade-transform-*`、`tag-move`、`tag-enter-*`、`tag-leave-*`、`el-collapse-transition-*`。
2. **Element Plus 内部覆盖**：`element.scss` 全部内容；`:deep()` 穿透；对 `.el-*` 内部的样式（如 `.el-menu-item.is-active`）。
3. **第三方库覆盖**：NProgress。
4. **复杂视觉**：`radial-gradient` / `mask-image` / `color-mix()` / `filter` / 复杂 `@media`。
5. **结构性机制**：`@layer base` 重置、主题切换过渡（`html.theme-transition`）。
6. **后代选择器**（`.a .b`）：Tailwind 需 `[&_.b]:` 语法，可读性下降，**建议保留 CSS**。

## 7. 迁移验收清单（每个批次）

- `npx eslint . --max-warnings 0`、`npx stylelint "**/*.{css,scss,vue}"`、`npx prettier --check`
- `cd admin && npx vue-tsc --noEmit`、`npx vite build`
- **人工目视回归**：亮/暗两种主题 + 窄屏（<768px）/ 宽屏；本项目**零自动化测试**，改动后必须手点核心页面。
- 注意：迁移 Tailwind 后，若类名由动态字符串拼接，将被 `content` 扫描遗漏 → **禁止动态拼 Tailwind 类名**，改用完整类名映射表。
