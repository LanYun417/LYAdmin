import { defineStore } from 'pinia';

interface AppState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 暗黑模式（与 html.dark 同步） */
  dark: boolean;
  /** 主题色 */
  primaryColor: string;
  /** 是否全屏（P2） */
  isFullscreen: boolean;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarCollapsed: false,
    dark: false,
    primaryColor: '#409eff',
    isFullscreen: false,
  }),

  actions: {
    /** 切换侧边栏折叠状态 */
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },

    /** 设置侧边栏折叠状态 */
    setSidebarCollapsed(value: boolean): void {
      this.sidebarCollapsed = value;
    },

    /** 设置暗黑模式 */
    setDark(value: boolean): void {
      this.dark = value;
    },

    /** 切换暗黑模式 */
    toggleDark(): void {
      this.dark = !this.dark;
    },

    /** 设置主题色 */
    setPrimaryColor(color: string): void {
      this.primaryColor = color;
    },

    /** 设置全屏状态 */
    setFullscreen(value: boolean): void {
      this.isFullscreen = value;
    },
  },

  persist: {
    key: 'ly_admin_app',
    pick: ['sidebarCollapsed', 'primaryColor'],
  },
});
