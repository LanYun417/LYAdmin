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
import { BIconLock, BIconPerson, BIconShieldCheck } from 'bootstrap-icons-vue';
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

/** 拉取 / 刷新验证码（单次有效：登录失败后需刷新） */
async function loadCaptcha(): Promise<void> {
  try {
    const res = await getCaptchaApi();
    captchaEnabled.value = res.enabled;
    captchaImage.value = res.image ?? '';
    form.captchaId = res.captchaId ?? '';
    form.captchaCode = '';
  } catch {
    // 获取失败不阻断登录页渲染；提交时由后端校验兜底拦截
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
          <el-input
            v-model="form.username"
            :prefix-icon="BIconPerson"
            placeholder="请输入账号"
            clearable
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="BIconLock"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item v-if="captchaEnabled" prop="captchaCode">
          <div class="flex w-full flex-nowrap items-center gap-3">
            <el-input
              v-model="form.captchaCode"
              :prefix-icon="BIconShieldCheck"
              placeholder="请输入验证码"
              maxlength="6"
              autocomplete="off"
              class="min-w-0 flex-1"
            />
            <img
              v-if="captchaImage"
              :src="captchaImage"
              alt="验证码"
              title="点击刷新"
              class="h-[40px] w-[110px] shrink-0 cursor-pointer rounded-md border border-line-light"
              @click="loadCaptcha"
            />
          </div>
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
