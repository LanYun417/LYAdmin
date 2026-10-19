<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store/modules/app';
import Breadcrumb from './Breadcrumb.vue';
import Avatar from './Avatar.vue';
import NoticeBell from './NoticeBell.vue';
import LocaleSwitcher from './LocaleSwitcher.vue';

defineOptions({ name: 'Navbar' });

const appStore = useAppStore();
const { t } = useI18n();

/**
 * 侧边栏开关的文字提示（tooltip 与 aria-label 共用同一份，避免两处文案漂移）。
 * 三态：移动端抽屉 / 展开 / 折叠。
 */
const toggleLabel = computed(() =>
  appStore.isMobile
    ? t('nav.toggleSidebar')
    : appStore.sidebarCollapsed
      ? t('nav.expandSidebar')
      : t('nav.collapseSidebar'),
);

/**
 * 侧边栏切换：
 * - 桌面端：折叠 / 展开侧边栏宽度
 * - 移动端：打开 / 关闭侧边栏悬浮抽屉
 */
function handleToggle(): void {
  if (appStore.isMobile) {
    appStore.toggleMobileDrawer();
  } else {
    appStore.toggleSidebar();
  }
}
</script>

<template>
  <div class="h-12.5 px-4 border-b border-line-light flex items-center justify-between shadow">
    <div class="flex items-center gap-3">
      <!-- 纯图标交互必须有文字提示：与全屏 / 暗黑切换保持一致 -->
      <el-tooltip :content="toggleLabel" placement="bottom">
        <el-icon
          class="text-lg text-ink cursor-pointer"
          role="button"
          tabindex="0"
          :aria-label="toggleLabel"
          @click="handleToggle"
        >
          <i v-if="appStore.isMobile" class="bi bi-list" />
          <i v-else-if="!appStore.sidebarCollapsed" class="bi bi-layout-sidebar-reverse" />
          <i v-else class="bi bi-layout-sidebar" />
        </el-icon>
      </el-tooltip>
      <Breadcrumb />
    </div>
    <div class="flex items-center gap-3">
      <LocaleSwitcher />
      <NoticeBell />
      <Avatar />
    </div>
  </div>
</template>
