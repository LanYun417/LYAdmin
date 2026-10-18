<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useAppStore } from '@/store/modules/app';
import { useTheme } from '@/composables/useTheme';
import { applyPrimaryColor } from '@/utils/theme';

defineOptions({ name: 'App' });

const appStore = useAppStore();

// 初始化应用持久化的主题色（刷新后仍生效），并跟随变化实时应用
applyPrimaryColor(appStore.primaryColor);
watch(
  () => appStore.primaryColor,
  (color) => applyPrimaryColor(color),
);

// 初始化暗黑模式：在根组件执行一次（单例，见 useTheme）
// useDark 的初始化会给 <html> 应用 localStorage 里的 dark 类——必须早于所有路由渲染，
// 否则无布局的登录页刷新后丢失暗黑模式（布局内组件此前是唯一初始化点，登录页覆盖不到）
useTheme();
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
