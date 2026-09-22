<script setup lang="ts">
import { Expand, Fold } from '@element-plus/icons-vue';
import { useAppStore } from '@/store/modules/app';
import Breadcrumb from './Breadcrumb.vue';
import Avatar from './Avatar.vue';

defineOptions({ name: 'Navbar' });

const appStore = useAppStore();

/** 折叠 / 展开侧边栏 */
function handleToggle(): void {
  appStore.toggleSidebar();
}
</script>

<template>
  <div class="navbar flex items-center justify-between shadow">
    <div class="flex items-center gap-3">
      <el-icon class="navbar-toggle" @click="handleToggle">
        <Fold v-if="!appStore.sidebarCollapsed" />
        <Expand v-else />
      </el-icon>
      <Breadcrumb />
    </div>
    <div class="flex items-center gap-3">
      <Avatar />
    </div>
  </div>
</template>

<style scoped>
.navbar {
  height: 50px;
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.navbar-toggle {
  font-size: 18px;
  color: var(--el-text-color-primary);
  cursor: pointer;
}
</style>
