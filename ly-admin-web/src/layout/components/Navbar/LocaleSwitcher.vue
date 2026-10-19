<script setup lang="ts">
/**
 * 顶栏语言切换器。
 *
 * 只做一件事：改 appStore.locale。真正的联动（vue-i18n / Element Plus locale / `<html lang>`）
 * 在 App.vue 里统一处理，这里不重复实现——避免两处各改一半导致不同步。
 */
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store/modules/app';
import { SUPPORT_LOCALES, type LocaleValue } from '@/locales';

defineOptions({ name: 'LocaleSwitcher' });

const appStore = useAppStore();
const { t } = useI18n();

/** 切换语言 */
function handleChange(value: LocaleValue): void {
  appStore.setLocale(value);
}
</script>

<template>
  <el-dropdown trigger="click" @command="handleChange">
    <el-icon class="text-lg text-ink cursor-pointer" role="button" tabindex="0" :aria-label="t('nav.language')">
      <i class="bi bi-translate" />
    </el-icon>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="item in SUPPORT_LOCALES"
          :key="item.value"
          :command="item.value"
          :disabled="item.value === appStore.locale"
        >
          {{ item.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
