# 12 - VueUse 常用技巧

VueUse 已配置自动导入（`imports: ['@vueuse/core']`），所有组合函数直接用，无需 import（见 06）。

## 高频组合函数

### 1. useStorage —— 响应式 localStorage

```ts
// 替代手写 localStorage 读写 + ref 同步
const theme = useStorage<'light' | 'dark'>('app-theme', 'light');
theme.value = 'dark'; // 自动持久化
```

> 项目持久化更推荐 Pinia 的 `persist`（见 08）；`useStorage` 适合轻量、与 store 无关的键值。

### 2. useDark —— 暗色模式

```ts
// useTheme 内部即基于 useDark（selector: 'html', attribute: 'class'），与 Element Plus 暗黑方案对齐
const isDark = useDark({ storageKey: 'ly_admin_theme' });
```

> 实际切换封装在 `src/composables/useTheme.ts`，统一处理 `html.dark` + app store 同步 + 颜色过渡。

### 3. useDebounceFn —— 防抖

```ts
const onSearch = useDebounceFn((kw: string) => {
  fetchList(kw);
}, 300);
```

### 4. useEventListener —— 自动解绑的事件监听

```ts
useEventListener(window, 'resize', onResize); // 组件卸载自动移除，无需 onUnmounted 手写
```

### 5. useWindowSize —— 视口尺寸（响应式封装依赖它）

```ts
// useResponsiveSize 内部用它判断视口是否小于桌面固定宽度
const { width } = useWindowSize();
```

### 6. useClipboard / useTitle

```ts
const { copy } = useClipboard();
await copy(orderNo);
ElMessage.success('单号已复制'); // 来自 @/utils/element

useTitle('订单列表'); // 响应式标题
```

## 最佳实践

1. **先查 VueUse 再手写**：防抖、节流、存储、剪贴板、媒体查询、视口尺寸等一律优先用 VueUse。
2. `useStorage` 的 key 统一 `app-` / `ly_admin_` 前缀，避免与其他应用冲突（本项目用 `ly_admin_theme` 等）。
3. 组合函数返回值按需解构，不要把整个返回对象挂到模板。

## 常见错误

| 现象                     | 原因                  | 解决                                                     |
| ------------------------ | --------------------- | -------------------------------------------------------- |
| `useDark is not defined` | d.ts 未生成           | 重启 dev                                                 |
| useStorage 不同步        | 两个标签页 key 不一致 | 确认 key 一致；跨页签同步由 VueUse 内置 storage 事件处理 |
| 防抖不生效               | 每次渲染重建函数      | 把 `useDebounceFn` 放在 setup 顶层，不放渲染函数里       |
