<script setup lang="ts">
import { BIconLayoutSidebar, BIconLayoutSidebarReverse, BIconList } from 'bootstrap-icons-vue';
import { useAppStore } from '@/store/modules/app';
import Breadcrumb from './Breadcrumb.vue';
import Avatar from './Avatar.vue';

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
  <div class="h-[50px] px-4 border-b border-line-light flex items-center justify-between shadow">
    <div class="flex items-center gap-3">
      <el-icon
        class="text-lg text-ink cursor-pointer"
        role="button"
        tabindex="0"
        :aria-label="appStore.isMobile ? '切换侧边栏' : appStore.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="handleToggle"
      >
        <BIconList v-if="appStore.isMobile" />
        <BIconLayoutSidebarReverse v-else-if="!appStore.sidebarCollapsed" />
        <BIconLayoutSidebar v-else />
      </el-icon>
      <Breadcrumb />
    </div>
    <div class="flex items-center gap-3">
      <Avatar />
    </div>
  </div>
</template>
