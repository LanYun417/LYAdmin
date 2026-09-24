import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/**
 * LYAdmin 根目录 ESLint 扁平配置（flat config）。
 * 统一覆盖后端 api 与前端 admin 的 TypeScript / Vue 源码。
 * 注意：注释内不可出现连续星号加斜杠的 glob 写法，否则会提前闭合块注释。
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.min.js',
      'api/uploads/**',
      'api/logs/**',
      'admin/src/auto-imports.d.ts',
      'admin/src/components.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue 单文件组件
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
    },
  },

  // TypeScript 通用规则
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // 未定义标识符交由 TypeScript 编译器检查（vue-tsc / tsc），
      // ESLint 的 no-undef 无法识别 TS 类型（如 HTMLDivElement、File）与 DOM 全局，会产生误报。
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // 前端浏览器环境
  {
    files: ['admin/**/*.{ts,vue,js,mjs}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
      },
    },
  },

  // 后端 Node 环境
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // 配置文件（Node/CJS）
  {
    files: ['**/*.cjs', '**/*.config.{js,mjs,ts}', '**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        // Node 内置全局：`api/scripts/bench-http.mjs` 等零依赖 Node 脚本会用到
        Buffer: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  prettierRecommended,
  {
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
