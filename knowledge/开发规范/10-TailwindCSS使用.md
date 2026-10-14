# 10 - Tailwind CSS 使用

## 选型：v3（preflight 关闭）

本项目采用 **Tailwind CSS v3**（已验证与 Element Plus 共存的方案最成熟）。关键配置：

```js
// admin/tailwind.config.js
export default {
  darkMode: 'class', // 与 Element Plus html.dark 方案对齐
  corePlugins: { preflight: false }, // 关键：关闭 CSS Reset
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {/* 映射 Element Plus 语义色，见下 */},
      boxShadow: { 'el-light': 'var(--el-box-shadow-light)' },
    },
  },
  plugins: [],
};
```

```js
// postcss.config.js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* src/styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 为什么关闭 preflight

Tailwind preflight 是激进的全局 Reset（`button { background: transparent }`、`img { display: block }` 等），会破坏 Element Plus 的按钮、表格、图片预览样式。本项目关闭 preflight，由 Element Plus 自带 reset 兜底，并在 `src/styles/index.css` 的 `@layer base` 自行补齐**必要**的 base 重置（box-sizing、border、body、img、a、ul/ol、h1-h6/p 等）。

> **不要删** `@layer base` 里的 `border-color/style/width` 重置：preflight 关闭后，缺了它 `border` 类不可见，或叠加 `border-solid` 时多出 3px 黑线。

## 语义色映射（theme.colors）

Tailwind 类名直接映射到 Element Plus 的 CSS 变量，自动适配亮/暗主题，避免两套叫法：

| 分类   | 类名                                          |
| ------ | --------------------------------------------- |
| 语义色 | `primary` `success` `warning` `danger` `info` |
| 背景   | `surface` `page` `overlay` `fill-light`       |
| 文字   | `ink` `ink-regular` `muted` `faint`           |
| 边框   | `line` `line-light` `line-lighter`            |

```html
<div class="bg-surface text-ink border-line">...</div>
```

## 阴影约定

阴影必须走 `theme.boxShadow` 定义（`shadow-el-light`），**不要**写成 `shadow-[var(--el-box-shadow-light)]`——Tailwind 会把 `var()` 判定为阴影颜色，只生成 `--tw-shadow-color` 而不产生 `box-shadow` 声明，导致阴影失效（真实缺陷）。

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

| 现象                           | 原因                     | 解决                                          |
| ------------------------------ | ------------------------ | --------------------------------------------- |
| 工具类不生效                   | content 未覆盖文件路径   | 检查 content glob 包含 `.vue`                 |
| el-button 背景透明             | preflight 冲突           | 确认 `corePlugins.preflight: false`           |
| 生产环境样式丢失               | 类名是动态拼接           | 用完整类名或 safelist                         |
| 改了 tailwind.config.js 不生效 | 配置变更不热更新         | **重启 dev server**                           |
| 阴影不显示                     | 写了 `shadow-[var(--x)]` | 改用 `theme.boxShadow` 里的 `shadow-el-light` |
