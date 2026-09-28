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
    <div class="h-[50px] overflow-hidden border-b border-line-light flex items-center justify-center">
      <img class="w-[23px] h-[23px]" :src="logoUrl" alt="logo" />
      <span v-show="!collapsed" class="ml-2 text-base font-semibold text-ink whitespace-nowrap">蓝云后台管理系统</span>
    </div>
  </router-link>
</template>
