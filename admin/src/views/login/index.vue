<script setup lang="ts">
import { reactive, ref, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import {
  BIconCodeSlash,
  BIconFileEarmarkText,
  BIconKey,
  BIconLock,
  BIconPerson,
  BIconShieldCheck,
} from 'bootstrap-icons-vue';
import logoUrl from '@/assets/logo.png';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { usernameRule } from '@/utils/validate';
import type { LoginParams } from '@/types/api';

defineOptions({ name: 'Login' });

/** 品牌展示区的能力标签（均为系统真实能力，用于体现专业感） */
interface LoginFeature {
  /** 标签图标组件（已在 utils/icons.ts 登记，静态引入即可直接 `:is` 渲染） */
  icon: Component;
  label: string;
}

const features: LoginFeature[] = [
  { icon: BIconShieldCheck, label: '按钮级权限' },
  { icon: BIconCodeSlash, label: '代码生成器' },
  { icon: BIconFileEarmarkText, label: '零依赖接口文档' },
  { icon: BIconKey, label: '双 Token 鉴权' },
];

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

/** 当前年份（运行时取值，避免版权年份写死后逐年过期） */
const currentYear = new Date().getFullYear();

const form = reactive<LoginParams>({
  username: isDev ? 'admin' : '',
  password: isDev ? '123456' : '',
});

const rules: FormRules<LoginParams> = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }, usernameRule],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

/** 提交登录 */
async function handleLogin(): Promise<void> {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  loading.value = true;
  try {
    await userStore.login(form);
    permissionStore.resetRoutes();
    ElMessage.success('登录成功');
    const redirect = (route.query.redirect as string) || '/home';
    await router.replace(redirect);
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page flex-center">
    <div class="login-card">
      <!-- 左栏：品牌展示区（宽屏显示，纯 CSS 装饰，无任何外链资源） -->
      <aside class="login-brand">
        <span class="login-brand__glow login-brand__glow--a" aria-hidden="true"></span>
        <span class="login-brand__glow login-brand__glow--b" aria-hidden="true"></span>
        <span class="login-brand__grid" aria-hidden="true"></span>

        <div class="login-brand__content">
          <div class="login-brand__head">
            <img class="login-brand__logo" :src="logoUrl" alt="logo" />
            <h2 class="login-brand__title">蓝云后台管理系统</h2>
            <p class="login-brand__tagline">开箱即用的通用中后台管理基座</p>
          </div>

          <ul class="login-brand__features">
            <li v-for="feature in features" :key="feature.label" class="feature">
              <span class="feature__icon"><component :is="feature.icon" /></span>
              <span class="feature__label">{{ feature.label }}</span>
            </li>
          </ul>

          <p class="login-brand__footer">© {{ currentYear }} 蓝云科技 · LYAdmin</p>
        </div>
      </aside>

      <!-- 右栏：登录表单区（跟随主题背景色） -->
      <section class="login-form-panel">
        <!-- 窄屏退化：顶部紧凑品牌头 -->
        <div class="login-brand-compact">
          <img class="login-brand-compact__logo" :src="logoUrl" alt="logo" />
          <div class="login-brand-compact__meta">
            <h2 class="login-brand-compact__title">蓝云后台管理系统</h2>
            <p class="login-brand-compact__subtitle">LYAdmin · 通用后台管理基座</p>
          </div>
        </div>

        <!-- 宽屏表单标题 -->
        <div class="login-form__heading">
          <h1 class="login-form__title">欢迎回来</h1>
          <p class="login-form__subtitle">请输入账号与密码以登录系统</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
          <el-form-item prop="username">
            <el-input v-model="form.username" :prefix-icon="BIconPerson" placeholder="请输入账号" clearable />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              :prefix-icon="BIconLock"
              placeholder="请输入密码"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" class="login-button" :loading="loading" @click="handleLogin"> 登 录 </el-button>
          </el-form-item>
        </el-form>

        <p v-if="devTip" class="login-tip">{{ devTip }}</p>
      </section>
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

.login-card {
  display: flex;
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  background-color: var(--el-bg-color);
  border-radius: 16px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 16%);
}

/* ------------------------------ 左栏：品牌展示 ------------------------------ */
.login-brand {
  position: relative;
  display: none;
  flex: 0 0 45%;
  flex-direction: column;
  padding: 40px 36px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(
    150deg,
    var(--el-color-primary) 0%,
    color-mix(in srgb, var(--el-color-primary) 68%, #04060c) 100%
  );
}

.login-brand__glow {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(6px);
}

.login-brand__glow--a {
  top: -60px;
  right: -50px;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgb(255 255 255 / 26%), transparent 70%);
}

.login-brand__glow--b {
  bottom: -80px;
  left: -70px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgb(255 255 255 / 14%), transparent 70%);
}

.login-brand__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgb(255 255 255 / 6%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 6%) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at 30% 18%, #000 0%, transparent 74%);
}

.login-brand__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.login-brand__logo {
  width: 48px;
  height: 48px;
  padding: 8px;
  background-color: rgb(255 255 255 / 92%);
  border-radius: 14px;
}

.login-brand__title {
  margin-top: 18px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 1px;
}

.login-brand__tagline {
  max-width: 300px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: rgb(255 255 255 / 80%);
}

.login-brand__features {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 36px;
}

.feature {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  color: rgb(255 255 255 / 90%);
}

.feature__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 15px;
  background-color: rgb(255 255 255 / 16%);
  border-radius: 8px;
}

.login-brand__footer {
  margin-top: auto;
  font-size: 12px;
  color: rgb(255 255 255 / 55%);
}

/* ------------------------------ 右栏：登录表单 ------------------------------ */
.login-form-panel {
  /* 局部覆盖 Element Plus 圆角基准，使输入框 / 按钮统一为圆润风格（无需 :deep 穿透） */
  --el-border-radius-base: 10px;

  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 40px 32px;
}

.login-brand-compact {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 28px;
}

.login-brand-compact__logo {
  width: 40px;
  height: 40px;
}

.login-brand-compact__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login-brand-compact__subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.login-form__heading {
  display: none;
  margin-bottom: 24px;
}

.login-form__title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login-form__subtitle {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
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

/* ------------------------------ 宽屏：启用双栏布局 ------------------------------ */
@media (width >= 1024px) {
  .login-page {
    padding: 24px;
  }

  .login-card {
    max-width: 920px;
    border-radius: 20px;
  }

  .login-brand {
    display: flex;
  }

  .login-form-panel {
    padding: 56px;
  }

  .login-brand-compact {
    display: none;
  }

  .login-form__heading {
    display: block;
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

html.dark .login-brand {
  background: linear-gradient(150deg, color-mix(in srgb, var(--el-color-primary) 60%, #05070d) 0%, #070b14 100%);
}
</style>
