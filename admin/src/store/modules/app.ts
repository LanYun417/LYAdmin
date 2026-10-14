/**
 * 应用级 UI 状态：侧边栏折叠、暗黑模式、主题色、全屏与移动端抽屉。
 */

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
    /** 是否移动端（视口宽度 < 768px），由布局层依据媒体查询同步，不持久化 */
    const isMobile = ref<boolean>(false);
    /** 移动端侧边栏抽屉是否展开，不持久化 */
    const mobileDrawerOpen = ref<boolean>(false);

    /** 切换侧边栏折叠状态 */
    function toggleSidebar(): void {
      sidebarCollapsed.value = !sidebarCollapsed.value;
    }

    /** 设置是否为移动端 */
    function setMobile(value: boolean): void {
      isMobile.value = value;
    }

    /** 切换移动端侧边栏抽屉 */
    function toggleMobileDrawer(): void {
      mobileDrawerOpen.value = !mobileDrawerOpen.value;
    }

    /** 设置移动端侧边栏抽屉展开状态 */
    function setMobileDrawer(value: boolean): void {
      mobileDrawerOpen.value = value;
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
      isMobile,
      mobileDrawerOpen,
      toggleSidebar,
      setSidebarCollapsed,
      setDark,
      toggleDark,
      setPrimaryColor,
      setFullscreen,
      setMobile,
      toggleMobileDrawer,
      setMobileDrawer,
    };
  },
  {
    persist: {
      key: 'ly_admin_app',
      pick: ['sidebarCollapsed', 'primaryColor', 'dark'],
    },
  },
);
