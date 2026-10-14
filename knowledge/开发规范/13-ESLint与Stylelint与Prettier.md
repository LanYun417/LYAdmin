# 13 - ESLint 与 Stylelint 与 Prettier

质量门禁由三件套构成：**ESLint（JS/TS/Vue 逻辑）** + **Stylelint（CSS/SCSS/Vue 样式）** + **Prettier（格式）**。三者配置均在**仓库根目录**，统一覆盖 `admin/` 与 `api/`。

## 分工铁律

- **ESLint**：代码质量（未使用变量、API 误用、Vue 规范、TS 类型）。
- **Stylelint**：样式质量（选择器命名、属性顺序、未知 at-rule）—— 本项目用 `stylelint-config-standard` + `stylelint-config-recess-order` + `stylelint-prettier`。
- **Prettier**：格式（分号、引号、行宽）。

交集（格式类规则）通过 `eslint-plugin-prettier/recommended` 与 `stylelint-prettier` 交给 Prettier，避免三者在格式上打架。

## ESLint 10 Flat Config（eslint.config.mjs）

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'admin/auto-imports.d.ts', 'admin/components.d.ts' /* ... */] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tseslint.parser /* ... */ } },
    rules: { 'vue/multi-word-component-names': 'off', 'vue/no-v-html': 'off', 'vue/require-default-prop': 'off' },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      'no-undef': 'off', // TS 文件交给 tsc/vue-tsc 检查，ESLint 的 no-undef 不识别 DOM 全局与类型
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  // 前端浏览器全局 / 后端 Node 全局 / 配置文件全局：分文件声明 globals
  prettierRecommended,
  { rules: { 'prettier/prettier': 'error' } },
];
```

**关键设计**：

1. Flat Config（`eslint.config.mjs`），非旧式 `.eslintrc`。
2. `no-undef: 'off'` 对 TS 文件——因为自动导入的 `ref`/`useRoute` 等不被 ESLint 识别，且 `no-undef` 无法识别 `HTMLDivElement`、`File` 等 DOM 全局，会产生误报；类型正确性交给 `vue-tsc` / `tsc`。
3. 自动导入的 `auto-imports.d.ts` / `components.d.ts` 在 `ignores` 中排除，不被 lint。
4. 浏览器 / Node / 配置文件三类全局分别在各自 `files` 块用 `languageOptions.globals` 声明。

## Prettier 配置（.prettierrc.json）

```json
{
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "vueIndentScriptAndStyle": false,
  "htmlWhitespaceSensitivity": "css"
}
```

`semi: true`、`singleQuote: true`、`printWidth: 120` 三项为团队铁律，任何编辑器/插件配置不得覆盖。

## Stylelint 配置（.stylelintrc.json）

```json
{
  "extends": ["stylelint-config-standard", "stylelint-config-recess-order"],
  "plugins": ["stylelint-prettier"],
  "overrides": [{ "files": ["**/*.vue"], "customSyntax": "postcss-html" }],
  "rules": {
    "prettier/prettier": true,
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "no-descending-specificity": null,
    "at-rule-no-unknown": [
      true,
      { "ignoreAtRules": ["tailwind", "apply", "variants", "responsive", "screen", "layer"] }
    ]
  }
}
```

> 放开 `selector-class-pattern` / `custom-property-pattern` 以兼容 Element Plus 的 BEM 类名与 `--el-*` 变量；`at-rule-no-unknown` 放行 Tailwind 指令（`@tailwind` / `@apply` / `@layer` 等）。

## 命令（根目录）

```bash
npm run lint           # eslint . --max-warnings 0
npm run lint:fix       # eslint . --fix
npm run format         # prettier --write "**/*.{js,mjs,cjs,ts,vue,json,css,scss,md,html}"
npm run format:check   # prettier --check ...
npm run stylelint      # stylelint "**/*.{css,scss,vue}"
npm run stylelint:fix  # stylelint ... --fix
```

提交时 lint-staged 会自动对暂存文件执行三者（见 15）。

## 常见错误

| 现象                            | 原因                       | 解决                                                              |
| ------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `ref` 报 no-undef               | 误开了 TS 文件的 no-undef  | 确认 `eslint.config.mjs` 中 `no-undef: 'off'`（勿手动加 globals） |
| ESLint 与 Prettier 互相改来改去 | prettier 集成缺失          | 已在配置数组靠后位置加入 `prettierRecommended`                    |
| `.eslintrc.cjs` 不生效          | ESLint 10 只认 Flat Config | 删除旧配置，统一 `eslint.config.mjs`                              |
| 样式报 at-rule-no-unknown       | Tailwind 指令被误判        | 已在 `at-rule-no-unknown` 的 ignoreAtRules 放行                   |
