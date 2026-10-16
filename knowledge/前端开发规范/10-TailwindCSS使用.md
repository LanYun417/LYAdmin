# 10 - Tailwind CSS 使用

## 选型：v4（preflight 关闭）

本项目采用 **Tailwind CSS v4**（4.3.x），通过 `@tailwindcss/vite` 插件接入。

> **历史沿革**：项目此前锁定 v3.4，原因是当时 Tailwind v4 尚未支持 Vite 8（本项目用Vite 8 Rolldown），
> 属真实硬性阻塞。自 **Tailwind v4.2.2（2026-03-18）加入 Vite 8 支持**后该阻塞已解除，
> 故升级至 v4。选型原则仍是「默认最新稳定版，除非存在依赖冲突」。

关键配置集中在 `src/styles/index.css`（v4 采用 CSS 优先配置，**不再有** `tailwind.config.js` / `postcss.config.js`）：

```js
// ly-admin-web/vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
});
```

```css
/* ly-admin-web/src/styles/index.css —— 拆分导入，故意省略 preflight.css */
@layer theme, base, components, utilities;
@import url('tailwindcss/theme.css') layer(theme);
@import url('tailwindcss/utilities.css') layer(utilities);

@theme {
  /* 设计令牌，见下方语义色映射 */
}
```

## 为什么关闭 preflight

Tailwind preflight 是激进的全局 Reset（`button { background: transparent }`、`img { display: block }` 等），会破坏 Element Plus 的按钮、表格、图片预览样式。本项目关闭 preflight，由 Element Plus 自带 reset 兜底，并在 `src/styles/index.css` 的 `@layer base` 自行补齐**必要**的 base 重置（box-sizing、border、body、img、a、ul/ol、h1-h6/p 等）。

**v4 的关闭方式**：不使用 `@import "tailwindcss"`（它会自动注入 preflight），而是**按官方拆分导入 theme / utilities 两层并省略 preflight.css**。v3 的 `corePlugins: { preflight: false }` 已失效。

> **不要删** `@layer base` 里的 `border-color/style/width` 重置：preflight 关闭后，缺了它 `border` 类不可见，或叠加 `border-solid` 时多出 3px 黑线。

## v3 → v4 迁移要点

| 项目        | v3                             | v4                                    |
| ----------- | ------------------------------ | ------------------------------------- |
| 接入        | postcss.config.js              | `@tailwindcss/vite` 插件              |
| 配置        | tailwind.config.js             | CSS 内 `@theme` / `@source`           |
| 入口        | `@tailwind base;`              | `@import "tailwindcss"`（或拆分导入） |
| 关preflight | `corePlugins.preflight: false` | 省略 `preflight.css` 导入             |
| 类名探测    | `content` 数组                 | 自动探测（可用 `@source` 补充）       |

已知的 v4 破坏性变更（本项目**均未使用**，无需改码）：`start-*`/`end-*` → `inset-s-*`/`inset-e-*`、`overflow-ellipsis` → `text-ellipsis`、`flex-shrink-*`/`flex-grow-*` → `shrink-*`/`grow-*`。

## 语义色映射（`@theme` 设计令牌）

Tailwind 类名直接映射到 Element Plus 的 CSS 变量，自动适配亮/暗主题，避免两套叫法。

v4 用 `@theme` 定义令牌（取代 v3 的 `theme.extend.colors`），定义在 `src/styles/index.css`：

| 分类   | 类名                                          | `@theme` 令牌        |
| ------ | --------------------------------------------- | -------------------- |
| 语义色 | `primary` `success` `warning` `danger` `info` | `--color-*`          |
| 背景   | `surface` `page` `overlay` `fill-light`       | `--color-surface` 等 |
| 文字   | `ink` `ink-regular` `muted` `faint`           | `--color-ink` 等     |
| 边框   | `line` `line-light` `line-lighter`            | `--color-line` 等    |

```css
@theme {
  --color-primary: var(--el-color-primary);
  --color-line-lighter: var(--el-border-color-lighter);
}
```

```html
<div class="bg-surface text-ink border-line">...</div>
```

新增令牌须遵循「语义 + 用途前缀」命名，避免出现多套叫法。

## 阴影约定

阴影必须走 `@theme` 的 `--shadow-*` 令牌（`shadow-el-light`），**不要**写成 `shadow-[var(--el-box-shadow-light)]`——Tailwind 会把 `var()` 判定为阴影颜色，只生成 `--tw-shadow-color` 而不产生 `box-shadow` 声明，导致阴影失效（真实缺陷）。

```css
@theme {
  --shadow-el-light: var(--el-box-shadow-light);
}
```

## 使用示例

```vue
<template>
  <div class="mx-auto max-w-3xl p-8">
    <div class="mb-6 flex items-center gap-4">
      <el-button type="primary">Tailwind 布局 + Element Plus 组件</el-button>
    </div>
  </div>
</template>
```

分工：布局 / 间距 / 排版 / 颜色 / 响应式 / 伪类用 Tailwind；组件内部样式交给 Element Plus，不用 Tailwind 去覆盖组件库内部样式。

## 常见错误

| 现象                             | 原因                          | 解决                                                          |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| 工具类不生效                     | 类名是动态拼接                | 用完整类名拼写，不要运行时拼字符串                            |
| el-button 背景透明 / 标题变小    | preflight 被注入              | 确认省略了 `preflight.css` 导入，勿用 `@import "tailwindcss"` |
| 未知 at-rule 报错（stylelint）   | v4 指令未放行                 | `.stylelintrc.json` 的 `ignoreAtRules` 需含 v4 指令           |
| 生产环境样式丢失                 | 构建期被裁剪                  | 确认类名为静态可扫描                                          |
| 阴影不显示                       | 写了 `shadow-[var(--x)]`      | 改用 `@theme` 的 `--shadow-el-light`                          |
| **全站工具类失效、样式全面崩溃** | `@import` 被写成 `url()` 形式 | 见下方「致命陷阱」，必须用无引号写法                          |

### 致命陷阱：`@import` 写成 `url()` 会让工具类整体静默失效

Tailwind v4 要求用**无引号字符串**形式导入：

```css
/* ✅ 正确 */
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

/* ❌ 错误：Tailwind 完全不解析，按普通 CSS 原样保留 */
@import url('tailwindcss/utilities.css') layer(utilities);
```

写成 `url(...)` 时**构建不报任何错**，但产物里会出现 `@layer utilities{@tailwind utilities;}`——
`@tailwind` 是 v3 指令残留。所有工具类（`flex`、`w-full`、`text-ink`…）静默不生成，页面样式全面崩溃。

**成因**：stylelint 的 `import-notation` 规则默认会把 `@import 'x'` 改写成 `@import url('x')`。
本项目已在 `.stylelintrc.json` 关闭该规则：

```json
"import-notation": null
```

**排查手法**：产物 CSS 中 `grep '@tailwind'`，有残留即中招；再看 utilities 段字节数，正常应在 15KB 以上。

> v4 的类名探测默认自动进行且随文件变更热更新，**不再有** v3「改配置需重启 dev server」的问题；
> 但改动 `@theme` 令牌后仍建议重启一次 dev server 以确保产物刷新。
