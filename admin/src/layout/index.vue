<script setup lang="ts">
import { computed, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useAppStore } from '@/store/modules/app';
import Sidebar from './components/Sidebar/index.vue';
import Navbar from './components/Navbar/index.vue';
import TagsView from './components/TagsView/index.vue';
import AppMain from './components/AppMain.vue';

defineOptions({ name: 'Layout' });

const appStore = useAppStore();

/** 移动端断点：视口宽度 < 768px */
const isMobileQuery = useMediaQuery('(max-width: 767px)');

const sidebarWidth = computed(() => (appStore.sidebarCollapsed ? '64px' : '210px'));

// 同步断点到 store；跨越断点时关闭抽屉，避免桌面端残留遮罩
watch(
  isMobileQuery,
  (value) => {
    appStore.setMobile(value);
    appStore.setMobileDrawer(false);
  },
  { immediate: true },
);

/** 移动端点击遮罩关闭抽屉 */
function closeDrawer(): void {
  appStore.setMobileDrawer(false);
}
</script>

<template>
  <div class="layout-container flex" :class="{ 'is-mobile': appStore.isMobile }">
    <!-- 移动端侧边栏遮罩 -->
    <transition name="fade">
      <div v-if="appStore.isMobile && appStore.mobileDrawerOpen" class="layout-mask" @click="closeDrawer" />
    </transition>

    <!-- 侧边栏：桌面端固定宽度占位；移动端切换为悬浮抽屉 -->
    <aside
      class="layout-sidebar"
      :class="{ 'is-drawer': appStore.isMobile, 'is-open': appStore.mobileDrawerOpen }"
      :style="appStore.isMobile ? undefined : { width: sidebarWidth }"
    >
      <Sidebar />
    </aside>

    <div class="layout-body flex-1 flex flex-col">
      <header class="layout-header">
        <Navbar />
        <TagsView />
      </header>
      <main class="layout-content flex-1">
        <!-- 内容区滚动条：用 el-scrollbar 替代原生滚动条 -->
        <el-scrollbar class="content-scrollbar">
          <AppMain />
        </el-scrollbar>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  width: 100%;
  height: 100%;
}

.layout-sidebar {
  height: 100%;
  overflow: hidden;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.28s;
}

.layout-body {
  height: 100%;
  overflow: hidden;
}

.layout-header {
  flex-shrink: 0;
  background-color: var(--el-bg-color);
}

/* 内容区：滚动交给 el-scrollbar，容器本身不再产生原生滚动条 */
.layout-content {
  flex: 1 1 auto;
  overflow: hidden;
  background-color: var(--el-bg-color-page);
}

.content-scrollbar {
  height: 100%;
}

/* ---------- 移动端（< 768px）：侧边栏改为悬浮抽屉 ---------- */
.layout-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgb(0 0 0 / 45%);
}

.layout-sidebar.is-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 1001;
  width: 210px;
  transform: translateX(-100%);
  transition: transform 0.28s ease;
}

.layout-sidebar.is-drawer.is-open {
  transform: translateX(0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.28s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
