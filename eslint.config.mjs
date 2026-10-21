import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/**
 * LYAdmin 根目录 ESLint 扁平配置（flat config）。
 * 统一覆盖新后端 ly-admin-api 与前端 ly-admin-web 的 TypeScript / Vue 源码。
 * 注意：注释内不可出现连续星号加斜杠的 glob 写法，否则会提前闭合块注释。
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      // 构建验证用临时输出目录（如 vite build --outDir dist-verify），
      // **/dist/** 匹配不到 dist-xxx 形式，需显式排除，否则 lint 需遍历整个产物
      '**/dist-*/**',
      '**/build/**',
      '**/coverage/**',
      // 前端构建产物映射目录（由 ly-admin-web 构建输出、同源部署时后端托管，非源码）
      'ly-admin-api/web/**',
      '**/*.min.js',
      // 前端自动生成的类型声明（unplugin-auto-import / unplugin-vue-components，格式由插件决定）
      'ly-admin-web/auto-imports.d.ts',
      'ly-admin-web/components.d.ts',
      // Vditor 自托管供应商静态资源，保持上游原样，不 lint 不格式化
      'ly-admin-web/public/vditor/**',
      // 后端：Prisma 生成客户端（构建产物）与运行时数据目录
      'ly-admin-api/src/generated/**',
      // 后端：接口文档数据（由 scripts/gen-api-docs.mjs 生成）
      'ly-admin-api/src/modules/docs/api-docs.generated.ts',
      'ly-admin-api/src/modules/docs/openapi.generated.ts',
      'ly-admin-api/uploads/**',
      'ly-admin-api/logs/**',
      'ly-admin-api/cache/**',
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
    files: ['ly-admin-web/**/*.{ts,vue,js,mjs}'],
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

  // 后端 Node 环境（纯 ESM，ly-admin-api/，无 __dirname/module/require）
  {
    files: ['ly-admin-api/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
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
        // Node 内置全局：零依赖 Node 脚本（scripts/*.mjs）会用到
        Buffer: 'readonly',
        URL: 'readonly',
        // 定时器不是 ES 内置全局， scripts/*.mjs 的轮询等待会用到
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Node 18+ 内置网络 API， dev.mjs 的健康检查轮询直接用，无需引第三方 HTTP 客户端
        fetch: 'readonly',
        AbortSignal: 'readonly',
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
