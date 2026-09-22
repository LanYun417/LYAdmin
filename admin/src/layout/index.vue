<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/store/modules/app';
import Sidebar from './components/Sidebar/index.vue';
import Navbar from './components/Navbar/index.vue';
import TagsView from './components/TagsView/index.vue';
import AppMain from './components/AppMain.vue';

defineOptions({ name: 'Layout' });

const appStore = useAppStore();
const sidebarWidth = computed(() => (appStore.sidebarCollapsed ? '64px' : '210px'));
</script>

<template>
  <div class="layout-container flex">
    <aside class="layout-sidebar" :style="{ width: sidebarWidth }">
      <Sidebar />
    </aside>
    <div class="layout-body flex-1 flex flex-col">
      <header class="layout-header">
        <Navbar />
        <TagsView />
      </header>
      <main class="layout-content flex-1">
        <AppMain />
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

.layout-content {
  overflow: auto;
  background-color: var(--el-bg-color-page);
}
</style>
