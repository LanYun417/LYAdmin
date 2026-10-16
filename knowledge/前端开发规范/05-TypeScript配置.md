# 05 - TypeScript 配置

前端 `ly-admin-web/` 采用两份 tsconfig 分工，与通用模板的"解决方案式三文件"不同（本项目为**单一应用配置 + Node 侧配置**，无 `tsconfig.app.json`）：

```
tsconfig.json        → 浏览器端（src/**、auto-imports.d.ts、components.d.ts）
tsconfig.node.json   → Node 侧（vite.config.ts）
```

## tsconfig.json（浏览器端，关键点）

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler", // 交给 Vite 解析，符合现代打包器语义
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "noUnusedLocals": false, // 未用变量交给 ESLint（@typescript-eslint/no-unused-vars）与 Vue 模板检查
    "noUnusedParameters": false,
    "noImplicitAny": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node", "element-plus/global"], // element-plus/global 兜底 ElMessage 等全局类型
    "paths": { "@/*": ["./src/*"] }, // 与 vite alias 对齐
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue", "auto-imports.d.ts", "components.d.ts"],
  "exclude": ["node_modules", "dist"],
}
```

**`include` 必须覆盖 `auto-imports.d.ts` 与 `components.d.ts`**，否则自动生成的标识符（`ref`、`useRoute`、`<el-button>` 等）会报 `Cannot find name`。

## tsconfig.node.json（Node 侧）

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
  },
  "include": ["vite.config.ts"],
}
```

## 类型检查命令

- 前端：`npm run type-check`（`vue-tsc --noEmit`）或 `npm run build`（`vue-tsc --noEmit && vite build`）。
- 后端：`cd ly-admin-api && npm run typecheck`（`tsc --noEmit`）。

> **注意**：Vue 文件必须用 `vue-tsc` 检查，不能用 `tsc`（不识别 SFC）。

## 最佳实践

1. 类型检查走 `vue-tsc --noEmit`，CI / 提交前自检必须执行。
2. 业务代码避免 `any`；第三方无类型包用 `declare module` 兜底并集中放在 `src/types/`。
3. 路径别名 `@/*` 三端（vite alias / tsconfig paths / 实际目录）必须一致。
4. `noUnusedLocals` / `noUnusedParameters` 关闭后，未用变量由 ESLint 的 `@typescript-eslint/no-unused-vars`（`argsIgnorePattern: '^_'`、`varsIgnorePattern: '^_'`）兜底，下划线前缀变量允许保留。

## 常见错误

| 现象                             | 原因                      | 解决                                           |
| -------------------------------- | ------------------------- | ---------------------------------------------- |
| `Cannot find name 'ref'`         | d.ts 未生成或未 include   | 跑一次 `npm run dev`；检查 `include` 覆盖 d.ts |
| vue 文件报类型错误但 ts 文件正常 | 用了 `tsc` 而非 `vue-tsc` | 统一 `vue-tsc --noEmit`                        |
| vite.config.ts 报错              | 被 app 配置 include 进去  | Node 侧文件只能被 tsconfig.node.json include   |
