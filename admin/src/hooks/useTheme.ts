import { computed, watch } from 'vue';
import { useDark, useToggle } from '@vueuse/core';
import { useAppStore } from '@/store/modules/app';

/** 主题切换过渡时长（ms），与 `styles/index.css` 中 `.theme-transition` 的 transition 保持一致 */
const THEME_TRANSITION_MS = 300;
/** 过渡期间临时挂在 `<html>` 上的类名（样式见 `styles/index.css`） */
const THEME_TRANSITION_CLASS = 'theme-transition';

/** 移除过渡类的定时器（连续切换时复用，避免类名残留） */
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * 让本次主题切换带一段颜色渐变。
 *
 * 做法：先给 `<html>` 挂上 `.theme-transition` 使过渡生效，并读取布局属性强制一次样式重算；
 * 随后由调用方切换 `dark` 类 → 颜色变化命中过渡 → 动画结束后移除该类。
 * 过渡类不常驻，避免全局 transition 带来的性能开销与交互干扰。
 */
function beginThemeTransition(): void {
  const root = document.documentElement;
  root.classList.add(THEME_TRANSITION_CLASS);
  // 读取布局属性以强制样式重算，确保紧随其后的颜色变化能被 transition 捕获
  void root.offsetWidth;
  if (transitionTimer !== undefined) {
    clearTimeout(transitionTimer);
  }
  transitionTimer = setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
    transitionTimer = undefined;
  }, THEME_TRANSITION_MS + 50);
}

/**
 * 暗黑模式切换封装。
 * 通过 VueUse `useDark` 统一切换 `html.dark`（与 Element Plus 暗黑方案对齐），
 * 并持久化到 localStorage（key: `ly_admin_theme`）；切换时带颜色过渡。
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

  /** 切换暗黑模式（带颜色过渡） */
  const toggleTheme = (): void => {
    beginThemeTransition();
    toggleDark();
  };

  /** 指定暗黑模式（带颜色过渡；值未变化时不触发） */
  const setDark = (value: boolean): void => {
    if (value === isDark.value) {
      return;
    }
    beginThemeTransition();
    isDark.value = value;
  };

  return { isDark: isDarkRef, toggleTheme, setDark };
}
