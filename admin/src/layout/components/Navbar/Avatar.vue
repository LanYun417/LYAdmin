<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
// 注意：BIconLayoutSidebar / BIconLayoutSidebarReverse 是「侧边栏折叠」的方向图标，
// 已被 Navbar 的侧边栏开关使用。全屏切换使用 BIconFullscreen（进入全屏）与
// BIconFullscreenExit（退出全屏），避免与侧边栏开关图标混淆。
import {
  BIconBoxArrowRight,
  BIconFullscreen,
  BIconFullscreenExit,
  BIconMoon,
  BIconPerson,
  BIconSun,
} from 'bootstrap-icons-vue';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { useAppStore } from '@/store/modules/app';
import { useTheme } from '@/hooks/useTheme';
import { applyPrimaryColor, DEFAULT_PRIMARY_COLOR } from '@/utils/theme';

defineOptions({ name: 'Avatar' });

const router = useRouter();
const userStore = useUserStore();
const permissionStore = usePermissionStore();
const appStore = useAppStore();
const { isDark, toggleTheme } = useTheme();

const avatar = computed(() => userStore.avatar);
const nickname = computed(() => userStore.nickname);

/** 主题色（双向绑定 app store） */
const primaryColor = computed({
  get: () => appStore.primaryColor,
  set: (value: string) => appStore.setPrimaryColor(value),
});

/** 跳转个人中心 */
function goProfile(): void {
  void router.push('/profile');
}

/** 退出登录 */
async function handleLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await userStore.logout();
  permissionStore.resetRoutes();
  void router.push('/login');
}

/** 切换全屏（P2） */
function handleToggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
    appStore.setFullscreen(false);
  } else {
    void document.documentElement.requestFullscreen();
    appStore.setFullscreen(true);
  }
}

/** 切换主题色（P2）：立即应用到 CSS 变量并持久化 */
function handlePrimaryColorChange(color: string | null): void {
  const value = color || DEFAULT_PRIMARY_COLOR;
  appStore.setPrimaryColor(value);
  applyPrimaryColor(value);
}
</script>

<template>
  <div class="navbar-avatar flex items-center gap-2">
    <el-tooltip :content="appStore.isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
      <el-icon class="navbar-action" @click="handleToggleFullscreen">
        <BIconFullscreen v-if="!appStore.isFullscreen" />
        <BIconFullscreenExit v-else />
      </el-icon>
    </el-tooltip>

    <el-tooltip :content="isDark ? '切换亮色' : '切换暗黑'" placement="bottom">
      <el-icon class="navbar-action" @click="toggleTheme">
        <BIconMoon v-if="!isDark" />
        <BIconSun v-else />
      </el-icon>
    </el-tooltip>

    <el-tooltip content="主题色" placement="bottom">
      <el-color-picker
        v-model="primaryColor"
        size="small"
        class="navbar-color-picker"
        @change="handlePrimaryColorChange"
      />
    </el-tooltip>

    <el-dropdown trigger="click">
      <div class="avatar-trigger flex items-center gap-2">
        <el-avatar :size="32" :src="avatar">
          <el-icon><BIconPerson /></el-icon>
        </el-avatar>
        <span class="avatar-name">{{ nickname }}</span>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item :icon="BIconPerson" @click="goProfile">个人中心</el-dropdown-item>
          <el-dropdown-item :icon="BIconBoxArrowRight" divided @click="handleLogout"> 退出登录 </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.navbar-action {
  font-size: 18px;
  color: var(--el-text-color-primary);
  cursor: pointer;
}

.navbar-color-picker {
  vertical-align: middle;
}

.avatar-trigger {
  cursor: pointer;
  outline: none;
}

.avatar-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}
</style>
