/** @type {import('tailwindcss').Config} */
export default {
  // 与 Element Plus 的 html.dark 方案对齐
  darkMode: 'class',
  // 关闭 preflight，避免全局重置破坏 Element Plus 组件样式（见架构文档 1.4 风险 A）
  corePlugins: {
    preflight: false,
  },
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 映射 Element Plus 的语义色变量：类名更短，且自动适配亮/暗主题。
      // 新增色名须与下列命名保持一致（语义 + 用途前缀），避免出现多套叫法。
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
      // 映射 Element Plus 的阴影变量。
      // 注意：阴影必须走 theme 定义，不能写成 `shadow-[var(--x)]` 任意值 ——
      // Tailwind 会把 var() 判定为「阴影颜色」，只生成 --tw-shadow-color 而不产生
      // box-shadow 声明，导致阴影完全失效（2026-09-28 真实缺陷）。
      boxShadow: {
        'el-light': 'var(--el-box-shadow-light)',
      },
    },
  },
  plugins: [],
};
