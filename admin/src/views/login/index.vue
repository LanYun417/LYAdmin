<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { BIconLock, BIconPerson } from 'bootstrap-icons-vue';
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

const form = reactive<LoginParams>({
  username: 'admin',
  password: '123456',
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
      <div class="login-header">
        <h2 class="login-title">蓝云后台管理系统</h2>
        <p class="login-subtitle">LYAdmin · 通用后台管理基座</p>
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
      <p class="login-tip">默认账号：admin / 123456</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1677ff 0%, #0b1f45 100%);
}

.login-card {
  box-sizing: border-box;
  width: 90%;
  max-width: 380px;
  padding: 32px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
}

.login-header {
  margin-bottom: 24px;
  text-align: center;
}

.login-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.login-button {
  width: 100%;
}

.login-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
