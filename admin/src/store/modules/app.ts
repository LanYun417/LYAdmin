import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useAppStore = defineStore(
  'app',
  () => {
    /** 侧边栏是否折叠 */
    const sidebarCollapsed = ref<boolean>(false);
    /** 暗黑模式（与 html.dark 同步） */
    const dark = ref<boolean>(false);
    /** 主题色 */
    const primaryColor = ref<string>('#409eff');
    /** 是否全屏（P2） */
    const isFullscreen = ref<boolean>(false);

    /** 切换侧边栏折叠状态 */
    function toggleSidebar(): void {
      sidebarCollapsed.value = !sidebarCollapsed.value;
    }

    /** 设置侧边栏折叠状态 */
    function setSidebarCollapsed(value: boolean): void {
      sidebarCollapsed.value = value;
    }

    /** 设置暗黑模式 */
    function setDark(value: boolean): void {
      dark.value = value;
    }

    /** 切换暗黑模式 */
    function toggleDark(): void {
      dark.value = !dark.value;
    }

    /** 设置主题色 */
    function setPrimaryColor(color: string): void {
      primaryColor.value = color;
    }

    /** 设置全屏状态 */
    function setFullscreen(value: boolean): void {
      isFullscreen.value = value;
    }

    return {
      sidebarCollapsed,
      dark,
      primaryColor,
      isFullscreen,
      toggleSidebar,
      setSidebarCollapsed,
      setDark,
      toggleDark,
      setPrimaryColor,
      setFullscreen,
    };
  },
  {
    persist: {
      key: 'ly_admin_app',
      pick: ['sidebarCollapsed', 'primaryColor'],
    },
  },
);
