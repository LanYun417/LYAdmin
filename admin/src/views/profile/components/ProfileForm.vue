<script setup lang="ts">
/** 修改资料表单。模块职责：编辑昵称 / 邮箱 / 手机号 / 性别，成功后同步回用户 Store。 */
import { computed, reactive, ref } from 'vue';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { updateProfileApi } from '@/api/profile';
import { useDict } from '@/composables/useDict';
import { useUserStore } from '@/store/modules/user';
import { emailRule, phoneRule } from '@/utils/validate';
import type { ProfileUpdateParams } from '@/types/api';

defineOptions({ name: 'ProfileForm' });

const userStore = useUserStore();
const formRef = ref<FormInstance>();
const submitting = ref(false);

/** 性别下拉：数据来自字典管理中的「用户性别」（sys_user_sex） */
const { options: genderOptions } = useDict('sys_user_sex');

const form = reactive<ProfileUpdateParams>({
  nickname: userStore.userInfo?.nickname ?? '',
  email: userStore.userInfo?.email ?? '',
  phone: userStore.userInfo?.phone ?? '',
  gender: userStore.userInfo?.gender ?? '',
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
      userStore.userInfo.gender = res.gender ?? null;
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
    <el-form-item label="性别">
      <el-select v-model="form.gender" placeholder="请选择性别" clearable style="width: 100%">
        <el-option v-for="item in genderOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存资料</el-button>
    </el-form-item>
  </el-form>
</template>
