import { computed, watch } from 'vue';
import { useDark, useToggle } from '@vueuse/core';
import { useAppStore } from '@/store/modules/app';

/**
 * 暗黑模式切换封装。
 * 通过 VueUse `useDark` 统一切换 `html.dark`（与 Element Plus 暗黑方案对齐），
 * 并持久化到 localStorage（key: `ly_admin_theme`）。
 */
export function useTheme() {
  const appStore = useAppStore();

  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: '',
    storageKey: 'ly_admin_theme',
    initialValue: 'light',
  });

  const toggleDark = useToggle(isDark);

  // 同步到 app store，供其他组件读取
  watch(
    isDark,
    (value) => {
      appStore.setDark(value);
    },
    { immediate: true },
  );

  const isDarkRef = computed(() => isDark.value);

  /** 切换暗黑模式 */
  const toggleTheme = (): void => {
    toggleDark();
  };

  /** 指定暗黑模式 */
  const setDark = (value: boolean): void => {
    isDark.value = value;
  };

  return { isDark: isDarkRef, toggleTheme, setDark };
}
