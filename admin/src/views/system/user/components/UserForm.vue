<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createUserApi, getUserDetailApi, updateUserApi } from '@/api/user';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { useDict, useStatusDict } from '@/hooks/useDict';
import { emailRule, phoneRule, usernameRule } from '@/utils/validate';
import type { RoleBrief, UserUpsert } from '@/types/api';

defineOptions({ name: 'UserForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的用户 id（为空表示新增） */
  userId?: number;
  /** 可选角色 */
  roleOptions: RoleBrief[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);

const defaultForm = (): UserUpsert => ({
  username: '',
  password: '',
  nickname: '',
  email: '',
  phone: '',
  gender: '',
  status: 1,
  roleIds: [],
  remark: '',
});

const form = reactive<UserUpsert>(defaultForm());

const isEdit = ref(false);

/** 性别下拉：数据来自字典管理中的「用户性别」（sys_user_sex），不再硬编码选项 */
const { options: genderOptions } = useDict('sys_user_sex');

/** 状态选项：数据来自字典管理中的「通用状态」（sys_common_status） */
const { statusOptions } = useStatusDict();

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }, usernameRule],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  email: [emailRule],
  phone: [phoneRule],
};

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载用户详情 */
async function loadDetail(id: number): Promise<void> {
  const detail = await getUserDetailApi(id);
  Object.assign(form, {
    username: detail.username,
    password: '',
    nickname: detail.nickname,
    email: detail.email ?? '',
    phone: detail.phone ?? '',
    gender: detail.gender ?? '',
    status: detail.status,
    roleIds: detail.roleIds ?? (detail.roles ?? []).map((role) => role.id),
    remark: detail.remark ?? '',
  });
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) {
      return;
    }
    resetForm();
    isEdit.value = Boolean(props.userId);
    if (props.userId) {
      await loadDetail(props.userId);
    }
  },
);

/** 关闭弹窗 */
function handleClose(): void {
  emit('update:modelValue', false);
}

/** 提交 */
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
    if (isEdit.value && props.userId) {
      const { username: _username, password: _password, ...rest } = form;
      await updateUserApi(props.userId, rest);
      ElMessage.success('更新成功');
    } else {
      await createUserApi({ ...form });
      ElMessage.success('新增成功');
    }
    emit('success');
    handleClose();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog
    :model-value="modelValue"
    :title="isEdit ? '编辑用户' : '新增用户'"
    width="560px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="账号" prop="username">
        <el-input v-model="form.username" :disabled="isEdit" placeholder="请输入账号" />
      </el-form-item>
      <el-form-item v-if="!isEdit" label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
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
      <el-form-item label="角色">
        <el-select v-model="form.roleIds" multiple placeholder="请选择角色" style="width: 100%">
          <el-option v-for="role in roleOptions" :key="role.id" :label="role.roleName" :value="role.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
