<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';
import Breadcrumb from './Breadcrumb.vue';
import Avatar from './Avatar.vue';
import NoticeBell from './NoticeBell.vue';
import LocaleSwitcher from './LocaleSwitcher.vue';

defineOptions({ name: 'Navbar' });

const appStore = useAppStore();

/**
 * 侧边栏切换：
 * - 桌面端：折叠 / 展开侧边栏宽度
 * - 移动端：打开 / 关闭侧边栏悬浮抽屉
 */
function handleToggle(): void {
  if (appStore.isMobile) {
    appStore.toggleMobileDrawer();
  } else {
    appStore.toggleSidebar();
  }
}
</script>

<template>
  <div class="h-12.5 px-4 border-b border-line-light flex items-center justify-between shadow">
    <div class="flex items-center gap-3">
      <el-icon
        class="text-lg text-ink cursor-pointer"
        role="button"
        tabindex="0"
        :aria-label="appStore.isMobile ? '切换侧边栏' : appStore.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="handleToggle"
      >
        <i v-if="appStore.isMobile" class="bi bi-list" />
        <i v-else-if="!appStore.sidebarCollapsed" class="bi bi-layout-sidebar-reverse" />
        <i v-else class="bi bi-layout-sidebar" />
      </el-icon>
      <Breadcrumb />
    </div>
    <div class="flex items-center gap-3">
      <LocaleSwitcher />
      <NoticeBell />
      <Avatar />
    </div>
  </div>
</template>
