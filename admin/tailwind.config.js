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
      colors: {
        primary: 'var(--el-color-primary)',
      },
    },
  },
  plugins: [],
};
