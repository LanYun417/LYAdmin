# 09 - Element Plus 使用

## 组件按需自动导入（本项目方案）

模板中直接写组件即可，无需 import、无需 `app.component` 注册：

```vue
<template>
  <el-button type="primary" @click="onSave">保存</el-button>
  <el-form>
    <el-form-item label="姓名">
      <el-input v-model="name" />
    </el-form-item>
  </el-form>
</template>
```

- 组件由 `unplugin-vue-components` + `ElementPlusResolver` 按需注册，用到哪个组件加载哪个组件的 CSS。
- 项目自有组件（`src/components`）也走 `Components` 的 `dirs` 自动注册，可直接使用 `<BasicDialog>` / `<Pagination>` 等。

## 命令式 API：必须走桶文件（重要）

`ElMessage` / `ElMessageBox` **不自动导入**，统一从 `utils/element.ts` 引入（避免整库打包）：

```ts
import { ElMessage, ElMessageBox } from '@/utils/element';

ElMessage.success('保存成功');
const { value } = await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' });
```

**禁止** `import { ElButton } from 'element-plus'` 与 `app.use(ElementPlus)` 全量注册——前者拖慢首屏，后者使按需加载失效。

## 中文语言包

语言包是资源文件，不在自动导入范围，在 `main.ts` 通过 `el-config-provider` 注入（本项目已接 `zh-cn`）：

```vue
<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
```

## 暗黑模式

`main.ts` 引入 `element-plus/theme-chalk/dark/css-vars.css`，暗黑切换由 `html.dark` 类驱动（与 `useTheme` / VueUse `useDark` 对齐）。Tailwind 的 `darkMode: 'class'` 与之同源。

## 主题 / 样式覆盖

- **全局覆盖**：`src/styles/element.scss`，仅做带命名空间的覆盖，不使用 `!important` 强行改写组件内部外观（如 `.sidebar`、`.el-table.el-table`、`.search-form`、`.table-action` 等命名空间钩子类不可删）。
- **Element Plus 变量**：优先用 CSS 变量（`--el-color-primary` 等）或 Tailwind 映射类（见 10）。
- **base 重置**：因关闭 preflight，`src/styles/index.css` 的 `@layer base` 自行补齐 `border-*`（color/style/width），缺了会导致 `border` 类不可见或渲染黑线，勿删。

## 最佳实践

1. 表格 Header 背景色等视觉规范通过 CSS 变量 / 命名空间类统一，不在每个页面写内联样式。
2. `ElMessage` 文案统一中文、句尾不加标点（与 commitlint subject 风格一致的约定）。
3. 弹窗类组件优先用 `v-model` 控制显隐；固定尺寸弹层必须走响应式封装（`useResponsiveSize` / `BasicDialog`，见 18）。

## 常见错误

| 现象                | 原因                                 | 解决                                          |
| ------------------- | ------------------------------------ | --------------------------------------------- |
| 组件无样式          | 手动 import 组件但没带样式           | 删掉手动 import，交给 resolver                |
| 首屏体积异常增大    | 从 `'element-plus'` 整库引入命令 API | 改为从 `@/utils/element` 引入                 |
| DatePicker 显示英文 | 未配置语言包                         | 确认 `el-config-provider` 已注入 `zh-cn`      |
| Tailwind 下按钮透明 | preflight 关闭后 base 未补齐 border  | 勿删 `index.css` 的 `@layer base` border 重置 |
