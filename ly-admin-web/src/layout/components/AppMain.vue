<script setup lang="ts">
import { useTagsViewStore } from '@/store/modules/tagsView';

defineOptions({ name: 'AppMain' });

const tagsViewStore = useTagsViewStore();

/** keep-alive 缓存的组件名列表 */
const cachedViews = computed(() => tagsViewStore.cachedViews);
</script>

<template>
  <section class="app-main">
    <!--
      ⚠️ 这里刻意**不使用** <transition> 包裹 <keep-alive>。
      两者组合时，导航到「本次会话首次访问」的页面会卡住进入过渡：旧页面已移除、
      新页面永不挂载，内容区整块空白，刷新后才恢复（2026-11-06 复现）。
      mode="out-in"、去掉 :key、把 cachedViews 提前写入，都无法根治；去掉 transition 后稳定。
      页面切换动效改由下方纯 CSS 的 page-in 动画承担（不依赖 vnode 过渡钩子）。
    -->
    <router-view v-slot="{ Component, route: currentRoute }">
      <keep-alive :include="cachedViews">
        <component :is="Component" :key="currentRoute.path" />
      </keep-alive>
    </router-view>
  </section>
</template>

<style scoped>
.app-main {
  min-height: 100%;
  padding: 16px;
}

/* 页面进入动效：只做「进入」的淡入 + 轻微上移，不参与 vnode 过渡，不会卡住路由切换 */
@keyframes page-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 只作用于页面根节点（子组件根元素会继承父级 scope id），不会波及页面内部元素 */
.app-main > * {
  animation: page-in 0.22s ease both;
}

/* 响应式：窄屏收窄内边距，把宽度让给内容；超宽屏适当放大留白 */
@media (width <= 767px) {
  .app-main {
    padding: 12px;
  }
}

@media (width >= 1600px) {
  .app-main {
    padding: 20px 24px;
  }
}
</style>
