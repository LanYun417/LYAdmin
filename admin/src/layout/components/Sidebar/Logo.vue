<script setup lang="ts">
import logoUrl from '@/assets/logo.png';

defineOptions({ name: 'SidebarLogo' });

defineProps<{
  /** 是否折叠 */
  collapsed: boolean;
}>();
</script>

<template>
  <router-link to="/home">
    <div class="sidebar-logo flex items-center justify-center">
      <img class="sidebar-logo-img" :src="logoUrl" alt="logo" />
      <span v-show="!collapsed" class="sidebar-logo-title">蓝云后台管理系统</span>
    </div>
  </router-link>
</template>

<style scoped>
.sidebar-logo {
  height: 50px;
  overflow: hidden;
  border-bottom: 1px solid var(--el-border-color-light);
}

.sidebar-logo-img {
  width: 23px;
  height: 23px;
}

.sidebar-logo-title {
  margin-left: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
</style>
