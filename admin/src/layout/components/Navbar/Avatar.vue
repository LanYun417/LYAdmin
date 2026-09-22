<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Expand, Fold, Moon, Sunny, User, SwitchButton } from '@element-plus/icons-vue';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { useAppStore } from '@/store/modules/app';
import { useTheme } from '@/hooks/useTheme';

defineOptions({ name: 'Avatar' });

const router = useRouter();
const userStore = useUserStore();
const permissionStore = usePermissionStore();
const appStore = useAppStore();
const { isDark, toggleTheme } = useTheme();

const avatar = computed(() => userStore.avatar);
const nickname = computed(() => userStore.nickname);

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
</script>

<template>
  <div class="navbar-avatar flex items-center gap-2">
    <el-tooltip content="全屏切换" placement="bottom">
      <el-icon class="navbar-action" @click="handleToggleFullscreen">
        <Expand v-if="!appStore.isFullscreen" />
        <Fold v-else />
      </el-icon>
    </el-tooltip>

    <el-tooltip :content="isDark ? '切换亮色' : '切换暗黑'" placement="bottom">
      <el-icon class="navbar-action" @click="toggleTheme">
        <Moon v-if="!isDark" />
        <Sunny v-else />
      </el-icon>
    </el-tooltip>

    <el-dropdown trigger="click">
      <div class="avatar-trigger flex items-center gap-2">
        <el-avatar :size="32" :src="avatar">
          <el-icon><User /></el-icon>
        </el-avatar>
        <span class="avatar-name">{{ nickname }}</span>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item :icon="User" @click="goProfile">个人中心</el-dropdown-item>
          <el-dropdown-item :icon="SwitchButton" divided @click="handleLogout"> 退出登录 </el-dropdown-item>
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

.avatar-trigger {
  cursor: pointer;
  outline: none;
}

.avatar-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}
</style>
