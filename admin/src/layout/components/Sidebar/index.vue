<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
import SidebarItem from './SidebarItem.vue';
import Logo from './Logo.vue';

defineOptions({ name: 'Sidebar' });

const route = useRoute();
const appStore = useAppStore();
const userStore = useUserStore();

/** 顶层可见菜单（过滤按钮与禁用项） */
const menus = computed(() => (userStore.menus ?? []).filter((menu) => menu.menuType !== 'F' && menu.status !== 0));

/** 当前高亮菜单 */
const activeMenu = computed(() => (route.meta.activeMenu as string) || route.path);
</script>

<template>
  <div class="sidebar flex flex-col h-full">
    <Logo :collapsed="appStore.sidebarCollapsed" />
    <el-scrollbar class="sidebar-scroll flex-1">
      <el-menu
        :default-active="activeMenu"
        :collapse="appStore.sidebarCollapsed"
        :collapse-transition="false"
        unique-opened
        router
      >
        <SidebarItem v-for="menu in menus" :key="menu.id" :item="menu" base-path="" />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.sidebar {
  overflow: hidden;
}

.sidebar-scroll {
  height: 100%;
}
</style>
