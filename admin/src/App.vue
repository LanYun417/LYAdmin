<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useAppStore } from '@/store/modules/app';
import { applyPrimaryColor } from '@/utils/theme';

defineOptions({ name: 'App' });

const appStore = useAppStore();

// 初始化应用持久化的主题色（刷新后仍生效），并跟随变化实时应用
applyPrimaryColor(appStore.primaryColor);
watch(
  () => appStore.primaryColor,
  (color) => applyPrimaryColor(color),
);
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
