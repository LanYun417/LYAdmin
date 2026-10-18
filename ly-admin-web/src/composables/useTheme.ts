/**
 * 暗黑模式 hook：基于 VueUse `useDark` 切换 `html.dark`，并同步到 app store、切换时带颜色过渡。
 */

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

/** useTheme 单例句柄：整个应用只创建一份，避免多实例的 useDark 各写各的 */
let themeHandle: ThemeHandle | undefined;

interface ThemeHandle {
  isDark: ComputedRef<boolean>;
  toggleTheme: () => void;
  setDark: (value: boolean) => void;
}

/**
 * 真正创建主题实例（只在首次调用 useTheme 时执行一次）。
 * 通过 VueUse `useDark` 统一切换 `html.dark`（与 Element Plus 暗黑方案对齐），
 * 并持久化到 localStorage（key: `ly_admin_theme`）；切换时带颜色过渡。
 */
function createThemeHandle(): ThemeHandle {
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

/**
 * 暗黑模式切换封装（单例，任意组件调用拿到的都是同一份状态）。
 *
 * 由 App.vue 在**根组件**中首次调用：`useDark` 的初始化（读取 localStorage 并给
 * `<html>` 应用 `dark` 类）随之发生在所有路由之前，无布局的登录页刷新后也能恢复
 * 暗黑模式。布局内组件（如 Navbar 头像下拉）复用同一实例，无需重复初始化。
 */
export function useTheme(): ThemeHandle {
  themeHandle ??= createThemeHandle();
  return themeHandle;
}
