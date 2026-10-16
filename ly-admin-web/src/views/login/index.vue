<script setup lang="ts">
/**
 * 登录页。
 * 模块职责：账号密码表单校验与登录，成功后重置权限路由并跳转到重定向目标（默认首页）。
 *
 * 版式：单栏居中卡片，顶部仅展示「LOGO + 系统名称」，不放标语 / 能力标签等介绍性内容。
 */

import { throttle } from 'lodash-es';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import logoUrl from '@/assets/logo-mark.svg';
import { getCaptchaApi } from '@/api/auth';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { usernameRule } from '@/utils/validate';
import type { LoginParams } from '@/types/api';

defineOptions({ name: 'Login' });

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const permissionStore = usePermissionStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
/** 是否开发环境（构建期常量；生产构建时被静态替换为 false） */
const isDev = import.meta.env.DEV;
/**
 * 开发环境登录提示文案。
 * 采用「构建期常量 + 三元」而非在模板里写死字面量：`import.meta.env.DEV` 在生产构建会被
 * 静态替换为 false，`false ? '…' : ''` 经常量折叠后整个字面量从产物中消失，避免明文凭据
 * 被打进生产 bundle（仅在模板用 v-if 无法删除已编译进 render 函数的字面量）。
 */
const devTip = import.meta.env.DEV ? '默认账号：admin / 123456（仅开发环境显示）' : '';

const form = reactive<LoginParams>({
  username: isDev ? 'admin' : '',
  password: isDev ? '123456' : '',
  captchaId: '',
  captchaCode: '',
});

/** 图形验证码图片（PNG data URL） */
const captchaImage = ref('');
/** 是否启用验证码（后端可关闭，关闭时隐藏输入项） */
const captchaEnabled = ref(false);
/**
 * 是否正在自动重试验证码。
 * 仅在**首次请求失败后**置位：正常加载只需几十毫秒，不会触发，避免提示闪现；
 * 后端未就绪时则会立刻显示「验证码加载中…」，而不是让验证码区域一片空白。
 */
const captchaRetrying = ref(false);
/** 自动重试已耗尽，需用户手动重试 */
const captchaFailed = ref(false);

/** 验证码失败后的自动重试上限（覆盖后端启动窗口） */
const CAPTCHA_RETRY_LIMIT = 5;
/** 验证码自动重试间隔（ms） */
const CAPTCHA_RETRY_DELAY = 1500;

/** 自动重试计时器（卸载时清理，避免离开页面后仍在轮询） */
let captchaRetryTimer: ReturnType<typeof setTimeout> | null = null;
/** 已自动重试次数 */
let captchaRetryCount = 0;

/** 取消进行中的自动重试 */
function clearCaptchaRetry(): void {
  if (captchaRetryTimer !== null) {
    clearTimeout(captchaRetryTimer);
    captchaRetryTimer = null;
  }
}

/**
 * 拉取 / 刷新验证码（单次有效：登录失败后需刷新）。
 *
 * 失败后**不再静默吞掉**：最常见的失败原因是**后端尚未就绪** —— 前端由 Vite 秒级就绪，
 * 而后端要等连库、建表与种子数据全部跑完才 `listen`；页面若落在这段窗口内加载，
 * 验证码请求会直接失败。旧实现吞掉该错误，验证码区域整块不渲染，用户必须点一次登录、
 * 被后端以「验证码错误」拒绝后才看到验证码。现改为失败后自动重试，耗尽上限再交由
 * 界面提示手动重试。
 * @param isRetry 内部自动重试标记；用户手动触发时省略（会重置计数并清除已有计时器）
 */
async function loadCaptcha(isRetry = false): Promise<void> {
  clearCaptchaRetry();
  if (!isRetry) {
    captchaRetryCount = 0;
    captchaFailed.value = false;
  }
  try {
    const res = await getCaptchaApi();
    captchaEnabled.value = res.enabled;
    captchaImage.value = res.image ?? '';
    form.captchaId = res.captchaId ?? '';
    form.captchaCode = '';
    captchaRetrying.value = false;
    captchaFailed.value = false;
  } catch (error) {
    console.error('[login] 获取验证码失败：', error);
    if (captchaRetryCount >= CAPTCHA_RETRY_LIMIT) {
      captchaRetrying.value = false;
      captchaFailed.value = true;
      return;
    }
    captchaRetryCount += 1;
    captchaRetrying.value = true;
    captchaRetryTimer = setTimeout(() => {
      void loadCaptcha(true);
    }, CAPTCHA_RETRY_DELAY);
  }
}

const rules = computed<FormRules<LoginParams>>(() => ({
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }, usernameRule],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaCode: captchaEnabled.value ? [{ required: true, message: '请输入验证码', trigger: 'blur' }] : [],
}));

/** 登录提交（实际逻辑） */
async function submitLogin(): Promise<void> {
  // 兜底防重复：loading 期间直接忽略（与下方 throttle 双保险）
  if (loading.value || !formRef.value) {
    return;
  }
  loading.value = true;
  try {
    const valid = await formRef.value.validate().catch(() => false);
    if (!valid) {
      return;
    }
    await userStore.login(form);
    permissionStore.resetRoutes();
    ElMessage.success('登录成功');
    const redirect = (route.query.redirect as string) || '/home';
    await router.replace(redirect);
  } catch {
    // 错误提示已由 axios 拦截器统一处理；验证码单次有效，失败后刷新
    await loadCaptcha();
  } finally {
    loading.value = false;
  }
}

/**
 * 登录动作：用 lodash `throttle` 节流 —— 首个触发**立即执行**，1s 内的后续触发被忽略，
 * 避免连点、以及回车与点击同时触发造成的重复登录（叠加验证码「单次有效」时第二次必然报错）。
 * 与 `loading` 哨兵形成双保险；窗口时长按需可调。
 */
const handleLogin = throttle(submitLogin, 1000, { leading: true, trailing: false });

onMounted(() => {
  void loadCaptcha();
});

// 离开登录页时取消进行中的重试计时器，避免页面卸载后仍在轮询
onBeforeUnmount(clearCaptchaRetry);
</script>

<template>
  <div class="login-page flex-center">
    <div class="login-card">
      <!-- 品牌头：仅 LOGO + 系统名称 -->
      <header class="login-header">
        <img class="login-header__logo" :src="logoUrl" alt="logo" />
        <h1 class="login-header__title">蓝云后台管理系统</h1>
      </header>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入账号" clearable autocomplete="username">
            <template #prefix><i class="bi bi-person" /></template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
          >
            <template #prefix><i class="bi bi-lock" /></template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="captchaEnabled" prop="captchaCode">
          <div class="flex w-full flex-nowrap items-center gap-3">
            <el-input
              v-model="form.captchaCode"
              placeholder="请输入验证码"
              maxlength="6"
              autocomplete="off"
              class="min-w-0 flex-1"
            >
              <template #prefix><i class="bi bi-shield-check" /></template>
            </el-input>
            <img
              v-if="captchaImage"
              :src="captchaImage"
              alt="验证码"
              title="点击刷新"
              class="h-10 w-27.5 shrink-0 cursor-pointer rounded-md border border-line-light"
              @click="loadCaptcha()"
            />
          </div>
        </el-form-item>
        <!-- 验证码加载中 / 加载失败：给出明确状态，避免用户误判为「本页无需验证码」 -->
        <el-form-item v-else-if="captchaRetrying">
          <p class="text-[13px] text-muted">验证码加载中…</p>
        </el-form-item>
        <el-form-item v-else-if="captchaFailed">
          <p class="text-[13px] text-muted">
            验证码加载失败，
            <span
              class="cursor-pointer text-primary underline"
              role="button"
              tabindex="0"
              @click="loadCaptcha()"
              @keyup.enter="loadCaptcha()"
            >
              重新加载
            </span>
          </p>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="login-button" :loading="loading" @click="handleLogin"> 登 录 </el-button>
        </el-form-item>
      </el-form>

      <p v-if="devTip" class="login-tip">{{ devTip }}</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
  height: 100%;
  padding: 16px;
  background-color: var(--el-bg-color-page);
  background-image:
    radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--el-color-primary) 18%, transparent), transparent 42%),
    radial-gradient(circle at 88% 88%, color-mix(in srgb, var(--el-color-primary) 14%, transparent), transparent 42%);
}

/* ------------------------------ 单栏登录卡片 ------------------------------ */
.login-card {
  /* 局部覆盖 Element Plus 圆角基准，使输入框 / 按钮统一为圆润风格（无需 :deep 穿透） */
  --el-border-radius-base: 10px;

  width: 100%;
  max-width: 420px;
  padding: 40px 32px;
  background-color: var(--el-bg-color);
  border-radius: 16px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 16%);
}

/* 品牌头：LOGO 居上、系统名称居下，整体居中 */
.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28px;
}

.login-header__logo {
  width: 56px;
  height: 56px;
}

.login-header__title {
  margin-top: 14px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 1px;
}

.login-button {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 4px;
  border-radius: 10px;
}

.login-tip {
  margin-top: 20px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

/* ------------------------------ 宽屏：加大留白 ------------------------------ */
@media (width >= 1024px) {
  .login-page {
    padding: 24px;
  }

  .login-card {
    padding: 48px 40px;
    border-radius: 20px;
  }
}

/* ------------------------------ 暗黑模式协调 ------------------------------ */
html.dark .login-page {
  background-image:
    radial-gradient(circle at 12% 12%, color-mix(in srgb, var(--el-color-primary) 26%, transparent), transparent 42%),
    radial-gradient(circle at 88% 88%, color-mix(in srgb, var(--el-color-primary) 18%, transparent), transparent 42%);
}

html.dark .login-card {
  border: 1px solid var(--el-border-color);
  box-shadow: 0 18px 48px rgb(0 0 0 / 55%);
}
</style>
