<script setup lang="ts">
import logoUrl from '@/assets/logo.svg';

defineOptions({ name: 'SidebarLogo' });

defineProps<{
  /** 是否折叠 */
  collapsed: boolean;
}>();
</script>

<template>
  <div class="sidebar-logo flex items-center justify-center">
    <img class="sidebar-logo-img" :src="logoUrl" alt="logo" />
    <span v-show="!collapsed" class="sidebar-logo-title">蓝云后台</span>
  </div>
</template>

<style scoped>
.sidebar-logo {
  height: 50px;
  overflow: hidden;
  border-bottom: 1px solid var(--el-border-color-light);
}

.sidebar-logo-img {
  width: 28px;
  height: 28px;
}

.sidebar-logo-title {
  margin-left: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
</style>
