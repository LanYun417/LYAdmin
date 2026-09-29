<script setup lang="ts">
/**
 * 侧边栏顶部品牌区。
 * 模块职责：展示 Logo 与系统名称，点击返回首页；折叠态下仅显示 Logo。
 */
import logoUrl from '@/assets/logo.png';

defineOptions({ name: 'SidebarLogo' });

defineProps<{
  /** 是否折叠 */
  collapsed: boolean;
}>();
</script>

<template>
  <router-link to="/home" class="block">
    <div
      class="h-[50px] flex items-center justify-center gap-2.5 border-b border-line-light overflow-hidden select-none"
    >
      <img class="w-6 h-6 shrink-0" :src="logoUrl" alt="logo" />
      <span
        v-show="!collapsed"
        class="text-[15px] font-bold tracking-[0.5px] whitespace-nowrap bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent"
      >
        蓝云后台管理系统
      </span>
    </div>
  </router-link>
</template>
