<script setup lang="ts">
/**
 * 根组件：暗黑模式 / 主题色 / 界面语言的初始化与联动。
 *
 * 界面语言的联动有**三处**，少一处就会出现"切了一半"的割裂感：
 * 1. `i18n.global.locale` —— 业务文案（`t()`）；
 * 2. `el-config-provider :locale` —— Element Plus 内置文案（分页、空状态、日期选择…）；
 * 3. `<html lang>` —— 浏览器与读屏软件识别的文档语言（无障碍相关）。
 */
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store/modules/app';
import { useTheme } from '@/composables/useTheme';
import { applyPrimaryColor } from '@/utils/theme';
import type { LocaleValue } from '@/locales';

defineOptions({ name: 'App' });

const appStore = useAppStore();
const { locale } = useI18n();

// 初始化应用持久化的主题色（刷新后仍生效），并跟随变化实时应用
applyPrimaryColor(appStore.primaryColor);
watch(
  () => appStore.primaryColor,
  (color) => applyPrimaryColor(color),
);

/** Element Plus 内置语言包映射（缺省回退中文，避免配置异常导致界面无文案）。 */
const EP_LOCALE: Record<LocaleValue, typeof zhCn> = {
  'zh-CN': zhCn,
  'en-US': en,
};

const elementLocale = computed(() => EP_LOCALE[appStore.locale] ?? zhCn);

/**
 * 同步界面语言到 i18n 与 `<html lang>`。
 * `el-config-provider` 那边由 elementLocale 的 computed 自动跟着变，这里只管另外两处。
 */
watch(
  () => appStore.locale,
  (value) => {
    locale.value = value;
    document.documentElement.lang = value;
  },
  { immediate: true },
);

// 初始化暗黑模式：在根组件执行一次（单例，见 useTheme）
// useDark 的初始化会给 <html> 应用 localStorage 里的 dark 类——必须早于所有路由渲染，
// 否则无布局的登录页刷新后丢失暗黑模式（布局内组件此前是唯一初始化点，登录页覆盖不到）
useTheme();
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
