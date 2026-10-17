<script setup lang="ts">
import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
import SidebarItem from './SidebarItem.vue';
import Logo from './Logo.vue';

defineOptions({ name: 'Sidebar' });

const route = useRoute();
const appStore = useAppStore();
const userStore = useUserStore();

/** 顶层可见菜单：过滤按钮、禁用项，以及 visible=0 的隐藏项（如个人中心，仍可从头像下拉进入） */
const menus = computed(() =>
  (userStore.menus ?? []).filter((menu) => menu.menuType !== 'F' && menu.status !== 0 && menu.visible !== 0),
);

/** 当前高亮菜单 */
const activeMenu = computed(() => (route.meta.activeMenu as string) || route.path);

/**
 * 菜单折叠。
 * 移动端侧边栏以悬浮抽屉形式展示，宽度固定且空间充足，此时强制展开，
 * 避免沿用桌面端的折叠状态导致抽屉里只剩图标、无法辨认。
 */
const collapsed = computed(() => appStore.sidebarCollapsed && !appStore.isMobile);

/**
 * 菜单选中回调：移动端点击叶子菜单跳转后**自动关闭抽屉**。
 *
 * 说明：抽屉是悬浮在内容之上的，若不关闭，跳转后它仍覆盖在页面上，
 * 用户需再点一次遮罩才能看到新页面。`@select` 只在叶子项（真正发生路由跳转）时触发，
 * 展开/收起子菜单不会触发，因此不会误关。
 */
function handleSelect(): void {
  if (appStore.isMobile) {
    appStore.setMobileDrawer(false);
  }
}
</script>

<template>
  <!-- 注意：`sidebar` 是 element.scss 中侧边栏菜单样式（高亮 / 悬停 / 左侧竖条指示器）的命名空间钩子，勿删 -->
  <div class="sidebar flex flex-col h-full overflow-hidden">
    <Logo :collapsed="collapsed" />
    <el-scrollbar class="h-full flex-1">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        unique-opened
        router
        @select="handleSelect"
      >
        <SidebarItem v-for="menu in menus" :key="menu.id" :item="menu" base-path="" />
      </el-menu>
    </el-scrollbar>
  </div>
</template>
