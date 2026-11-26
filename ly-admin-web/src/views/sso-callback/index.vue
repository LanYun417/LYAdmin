<script setup lang="ts">
/**
 * SSO 回调中转页。
 * 模块职责：OIDC 提供方 → 后端 → 302 到这里；URL 只带一次性 ticket，
 * 本页用 ticket 换正式登录态后清理 URL，避免令牌留在浏览器历史里。
 *
 * 失败路径（reason 参数）：给出原因并引导回登录页，不静默卡死。
 */

import { redeemSsoTicketApi } from '@/api/sso';
import { setToken } from '@/utils/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useUserStore } from '@/store/modules/user';

defineOptions({ name: 'SsoCallback' });

const route = useRoute();
const router = useRouter();
const permissionStore = usePermissionStore();
const userStore = useUserStore();

/** 处理中提示（整页只干一件事，不需要复杂状态机） */
const status = ref<'loading' | 'error'>('loading');
const message = ref('');

onMounted(async () => {
  const ticket = route.query.ticket;
  const reason = route.query.reason;
  if (typeof reason === 'string' && reason) {
    status.value = 'error';
    message.value = reason;
    return;
  }
  if (typeof ticket !== 'string' || !ticket) {
    status.value = 'error';
    message.value = '回调参数缺失，请重新登录';
    return;
  }
  try {
    const result = await redeemSsoTicketApi(ticket);
    setToken(result.accessToken, result.refreshToken);
    // 同步写 store：用户信息 / 菜单由首页守卫的 loadUserInfo 拉全，
    // 但 accessToken 必须先就位，否则守卫会判未登录又跳回登录页（死循环）
    userStore.accessToken = result.accessToken;
    userStore.refreshToken = result.refreshToken;
    permissionStore.resetRoutes();
    // 清掉 URL 上的 ticket，再进首页：history 里不留令牌痕迹
    await router.replace('/home');
  } catch {
    status.value = 'error';
    message.value = '登录票据无效或已过期，请重新登录';
  }
});

/** 回登录页 */
function backToLogin(): void {
  void router.replace('/login');
}
</script>

<template>
  <div class="sso-callback flex-center">
    <div class="sso-callback__card">
      <p v-if="status === 'loading'" class="text-muted">正在完成单点登录…</p>
      <template v-else>
        <p class="text-danger">{{ message }}</p>
        <el-button type="primary" class="mt-4" @click="backToLogin">返回登录页</el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sso-callback {
  width: 100%;
  height: 100%;
  background-color: var(--el-bg-color-page);
}

.sso-callback__card {
  padding: 32px 40px;
  text-align: center;
  background-color: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}
</style>
