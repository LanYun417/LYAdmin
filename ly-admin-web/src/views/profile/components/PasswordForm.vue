<script setup lang="ts">
/** 修改密码表单。模块职责：校验原密码与两次新密码一致，修改成功后登出并跳回登录页。 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { changePasswordApi } from '@/api/profile';
import { useUserStore } from '@/store/modules/user';
import { usePermissionStore } from '@/store/modules/permission';
import { PASSWORD_REGEX } from '@/utils/validate';
import type { ChangePasswordParams } from '@/types/api';

defineOptions({ name: 'PasswordForm' });

const router = useRouter();
const userStore = useUserStore();
const permissionStore = usePermissionStore();

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive<ChangePasswordParams>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

/** 确认密码校验 */
function validateConfirm(_rule: unknown, value: string, callback: (error?: Error) => void): void {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'));
    return;
  }
  callback();
}

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { pattern: PASSWORD_REGEX, message: '密码为 6-20 位字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
};

/** 提交修改密码 */
async function handleSubmit(): Promise<void> {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  submitting.value = true;
  try {
    await changePasswordApi({ ...form });
    ElMessage.success('密码修改成功，请重新登录');
    formRef.value.resetFields();
    await userStore.logout();
    permissionStore.resetRoutes();
    await router.replace('/login');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="password-form">
    <el-form-item label="原密码" prop="oldPassword">
      <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入原密码" />
    </el-form-item>
    <el-form-item label="新密码" prop="newPassword">
      <el-input v-model="form.newPassword" type="password" show-password placeholder="请输入新密码" />
    </el-form-item>
    <el-form-item label="确认密码" prop="confirmPassword">
      <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">修改密码</el-button>
    </el-form-item>
  </el-form>
</template>
