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

## 图标：Bootstrap Icons 字体方案

图标统一用 `bootstrap-icons` 的**图标字体**，直接写 CSS 类名，**不 import 任何组件**：

```vue
<!-- 普通场景 -->
<el-icon><i class="bi bi-house" /></el-icon>

<!-- el-button：走 #icon 插槽（EP 会自动包一层 el-icon） -->
<el-button type="primary" @click="handleAdd">
  <template #icon><i class="bi bi-plus" /></template>
  新增
</el-button>

<!-- el-input：走 #prefix 插槽 -->
<el-input v-model="keyword" placeholder="搜索">
  <template #prefix><i class="bi bi-search" /></template>
</el-input>

<!-- el-dropdown-item 没有 icon 插槽，直接内联（其 CSS 命中 i{margin-right:5px}） -->
<el-dropdown-item @click="goProfile"><i class="bi bi-person" /> 个人中心</el-dropdown-item>
```

要点：

- **类名 = `bi bi-<原生名>`**，原名取自 [图标清单](https://icons.getbootstrap.com/)（如 `bi-diagram-3`、`bi-folder2-open`、`bi-person-fill`）。
- **不要用 `:icon="..."` 传图标**：该 prop 只接受组件对象，字体方案下传字符串会被当成组件名解析而失效。
- **无注册表、无需登记**：全部 2078 个图标可用，菜单里任选图标都立即可用，新增图标不必改代码或重新构建。
- 数据库 `sys_menu.icon` 存的是**原生名**（不含 `bi-` 前缀，如 `diagram-3`）；渲染时拼成 `bi bi-<原生名>` 类名。

## 命令式 API：必须走桶文件（重要）

`ElMessage` / `ElMessageBox` **不自动导入**，统一从 `utils/element.ts` 引入（避免整库打包）：

```ts
import { ElMessage, ElMessageBox } from '@/utils/element';

ElMessage.success('保存成功');
const { value } = await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' });
```

**禁止** `import { ElButton } from 'element-plus'` 与 `app.use(ElementPlus)` 全量注册——前者拖慢首屏，后者使按需加载失效。

## 多语言（i18n）

语言包是资源文件，不在自动导入范围，在 `App.vue` 通过 `el-config-provider` 注入。

**联动三处**（少一处就会出现「切了一半」的割裂感）：

| 位置         | 代码                            | 管什么                                 |
| ------------ | ------------------------------- | -------------------------------------- |
| vue-i18n     | `i18n.global.locale`            | 业务文案（`t()`）                      |
| Element Plus | `<el-config-provider :locale>`  | 组件内置文案（分页、空状态、日期选择） |
| 文档语言     | `document.documentElement.lang` | 浏览器与读屏软件识别的语言（无障碍）   |

```vue
<!-- App.vue（节选） -->
<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';

const EP_LOCALE = { 'zh-CN': zhCn, 'en-US': en };
const elementLocale = computed(() => EP_LOCALE[appStore.locale] ?? zhCn);

// 业务文案与 <html lang> 由 watch 跟随 store
watch(
  () => appStore.locale,
  (value) => {
    locale.value = value;
    document.documentElement.lang = value;
  },
  { immediate: true },
);
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
```

### 组织与约定

- 语言包在 `src/locales/`：`zh-CN.ts`（基准）、`en-US.ts`、`index.ts`（实例 + `SUPPORT_LOCALES`）。
- key 命名 `<模块/页面>.<字段>`，常用动作放 `common` 复用（见 `common.*` / `nav.*` / `login.*` / `notice.*`）。
- **增量迁移**：存量页面有大量硬编码中文，不做一次性大改（会让 diff 失去可读性）；
  约定是**新增/改动的文案一律走 `t()`**，存量按页面逐步迁移。
- 切换入口在顶栏 `LocaleSwitcher.vue`，只改 `appStore.locale`（与主题色一起持久化，刷新保持）。
- `main.ts` 在 `app.use(i18n)` 之前先按持久化偏好设置 locale，避免首屏闪一下默认语言。

### 门禁

`npm run guard:locale`（`scripts/check-locale-keys.mjs`，已进 CI）：校验两侧语言包
**key 集合完全一致**、值非空、`{count}` 这类插值占位符成对出现。
漏一个 key 不会报错，只会在英文界面露出中文，属于「看起来能跑、实际很难发现」的问题。

> 写这个脚本时踩过的坑：曾用 `/^\s*import[^;]+;\s*$/gm` 剥离 import，该正则会**跨行匹配**
> （`\s*` 含换行），把注释到最后一个分号整段吞掉——42 个 key 只解析出 8 个却"检查通过"，
> 比没有门禁更危险。现在只剥 `export default`，import 行自然匹配不上解析规则。

### 为什么用 vue-i18n

语言包合并、插值、日期数字本地化、与 Element Plus locale 的联动都是成熟约定；
自己撸一个 `t()` 等于长期维护一份半成品。注意「零运行时依赖」是**后端**的约束，
前端本来就有 11 个运行时依赖（vue / pinia / element-plus / echarts …），
新增依赖已登记进 `scripts/deps-baseline.json`。

## el-tree 回填勾选：不要用 `setCheckedKeys`（会级联补全）

角色授权的抽屉要"按服务端返回的 id 还原勾选状态"。直觉写法是 `tree.setCheckedKeys(ids)`，
但**在父级 id 也在列表里时会出严重问题**：用户取消掉的权限，重新打开抽屉又"自己回来了"。

### 机制（看源码才明白）

`el-tree` 内部 `_setCheckedKeys` 对列表里的**非叶子**节点执行的是
`node.setChecked(true, true)` —— 第二个参数是 **deep**，即**深度级联，勾上该节点下所有子孙**。
更糟的是：级联勾上的子孙会被内部 `cache` 标记保护，后面的"不在列表里就取消"那段循环**跳过它们**，
所以级联结果不会被纠正。

而角色授权保存的恰恰是「勾选 + 半选」（半选父级必须一起存，否则后端拼不出菜单树），
半选父级一旦进入列表 → 它下面**全部**子孙被补成勾选。

### 实测（真实菜单树 + 「只读访客」角色的 13 个授权 id）

| 回填方式                                  | 结果                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `setCheckedKeys(ids)`                     | 13 个 id → **50 个勾选**（多出「系统管理」下所有未授权按钮：新增用户、删除角色、清空 HTTP 日志…） |
| 清空 + 逐个 `setChecked(id, true, false)` | 11 勾选 + 2 半选 = **13，与服务端完全一致**                                                       |

### 正确写法

```js
// 先清空（空列表走的是"逐个取消、不级联"的分支）
tree.setCheckedKeys([]);
// 再逐节点设置：deep=false 不向下联动；node.setChecked 末尾会自动 reInitChecked(parent)，
// 父级的全选 / 半选状态照样算对，所以"父级授权但子项未授权"也能如实还原
for (const id of ids) {
  tree.setChecked(id, true, false);
}
```

### 另一个必踩的点：别再传 `default-checked-keys`

`el-tree` 初始化时对默认勾选同样走级联（`node.setChecked(true, !checkStrictly)`）。
如果同时保留 `:default-checked-keys` 和上面的手动回填，就有两条互相覆盖的路径——
**回填只保留一条**（本项目 `components/MenuTree` 用 watcher + 手动回填，模板里不再传该属性）。

### 自查清单

- 回填后断言一次：`getCheckedKeys().length + getHalfCheckedKeys().length === 服务端 id 数`；
- 若用 `check-strictly`（父子不关联）就不存在级联问题，但要自己在保存时补全祖先 id。

## 暗黑模式

`main.ts` 引入 `element-plus/theme-chalk/dark/css-vars.css`，暗黑切换由 `html.dark` 类驱动（与 `useTheme` / VueUse `useDark` 对齐）。Tailwind 的 `darkMode: 'class'` 与之同源。

## 主题 / 样式覆盖

- **全局覆盖**：`src/styles/element.scss`，仅做带命名空间的覆盖，不使用 `!important` 强行改写组件内部外观（如 `.sidebar`、`.el-table.el-table`、`.search-form`、`.table-action` 等命名空间钩子类不可删）。
- **Element Plus 变量**：优先用 CSS 变量（`--el-color-primary` 等）或 Tailwind 映射类（见 10）。
- **base 重置**：因关闭 preflight，`src/styles/index.css` 的 `@layer base` 自行补齐 `border-*`（color/style/width），缺了会导致 `border` 类不可见或渲染黑线，勿删。

## 最佳实践

1. 表格 Header 背景色等视觉规范通过 CSS 变量 / 命名空间类统一，不在每个页面写内联样式。
2. `ElMessage` 文案统一中文、句尾不加标点（与 commitlint subject 风格一致的约定）。
3. 弹窗类组件优先用 `v-model` 控制显隐；固定尺寸弹层必须走响应式封装（`useResponsiveSize` / `BasicDialog`，见 17）。
4. **纯图标交互必须配 `el-tooltip`**：只有图标、没有文字标签的按钮（顶栏侧边栏开关 / 语言 /
   通知铃铛 / 全屏 / 暗黑切换等）一律套 `<el-tooltip placement="bottom">`，
   否则新用户无从判断图标含义。配套要求：
   - tooltip 的 `content` 与 `aria-label` **用同一个变量**（如 Navbar 的 `toggleLabel`），不要写两遍；
   - tooltip 与 dropdown / popover 组合时，tooltip 在**外层**并用 `<span>` 承载触发节点
     （组件根节点挂指令会有 Vue 告警，写法同 Avatar.vue 的主题色 picker）；
   - 文案走 `t()`，别再写死中文。

## 常见错误

| 现象                | 原因                                 | 解决                                          |
| ------------------- | ------------------------------------ | --------------------------------------------- |
| 组件无样式          | 手动 import 组件但没带样式           | 删掉手动 import，交给 resolver                |
| 首屏体积异常增大    | 从 `'element-plus'` 整库引入命令 API | 改为从 `@/utils/element` 引入                 |
| DatePicker 显示英文 | 未配置语言包                         | 确认 `el-config-provider` 已注入 `zh-cn`      |
| Tailwind 下按钮透明 | preflight 关闭后 base 未补齐 border  | 勿删 `index.css` 的 `@layer base` border 重置 |
