<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { updateProfileApi } from '@/api/profile';
import { useUserStore } from '@/store/modules/user';
import { emailRule, phoneRule } from '@/utils/validate';
import type { ProfileUpdateParams } from '@/types/api';

defineOptions({ name: 'ProfileForm' });

const userStore = useUserStore();
const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive<ProfileUpdateParams>({
  nickname: userStore.userInfo?.nickname ?? '',
  email: userStore.userInfo?.email ?? '',
  phone: userStore.userInfo?.phone ?? '',
  avatar: userStore.userInfo?.avatar ?? '',
});

const rules: FormRules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  email: [emailRule],
  phone: [phoneRule],
};

const username = computed(() => userStore.userInfo?.username ?? '');

/** 提交资料修改 */
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
    const res = await updateProfileApi({ ...form });
    if (userStore.userInfo) {
      userStore.userInfo.nickname = res.nickname;
      userStore.userInfo.email = res.email ?? null;
      userStore.userInfo.phone = res.phone ?? null;
    }
    ElMessage.success('资料更新成功');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="profile-form">
    <el-form-item label="账号">
      <el-input :model-value="username" disabled />
    </el-form-item>
    <el-form-item label="昵称" prop="nickname">
      <el-input v-model="form.nickname" placeholder="请输入昵称" />
    </el-form-item>
    <el-form-item label="邮箱" prop="email">
      <el-input v-model="form.email" placeholder="请输入邮箱" />
    </el-form-item>
    <el-form-item label="手机号" prop="phone">
      <el-input v-model="form.phone" placeholder="请输入手机号" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存资料</el-button>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.profile-form {
  max-width: 480px;
}
</style>
