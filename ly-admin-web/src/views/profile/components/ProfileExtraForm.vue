<script setup lang="ts">
/**
 * 扩展资料表单（个人中心 Sprint 5）：简介 / 生日 / 公司 / 职位 / 所在地。
 *
 * 与「修改资料」（昵称/邮箱/手机，属于账户域）分开：
 * 账户域字段管理员也能改，资料域字段只归用户自己维护（sys_user_profile 表）。
 */
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { updateProfileExtraApi } from '@/api/profile';
import type { ProfileDetail } from '@/types/api';

const props = defineProps<{
  /** 详情（父组件加载后传入；null 表示尚未加载） */
  detail: ProfileDetail | null;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const formRef = ref<FormInstance>();
const saving = ref(false);

const form = reactive({
  signature: '',
  birthday: '' as string,
  company: '',
  position: '',
  address: '',
});

const rules: FormRules = {
  signature: [{ max: 200, message: '简介最长 200 个字符', trigger: 'blur' }],
  company: [{ max: 100, message: '公司名最长 100 个字符', trigger: 'blur' }],
  position: [{ max: 50, message: '职位最长 50 个字符', trigger: 'blur' }],
  address: [{ max: 200, message: '所在地最长 200 个字符', trigger: 'blur' }],
};

/** 详情变化时回填（父组件异步加载完成后调用）。 */
watch(
  () => props.detail,
  (detail) => {
    if (!detail) {
      return;
    }
    form.signature = detail.signature ?? '';
    // 后端 Date 序列化为 ISO 串（含 T 与时间），日期选择器只吃 YYYY-MM-DD
    form.birthday = detail.birthday ? detail.birthday.slice(0, 10) : '';
    form.company = detail.company ?? '';
    form.position = detail.position ?? '';
    form.address = detail.address ?? '';
  },
  { immediate: true },
);

/** 提交。 */
async function handleSave(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (valid === false) {
    return;
  }
  saving.value = true;
  try {
    await updateProfileExtraApi({
      signature: form.signature,
      birthday: form.birthday || null,
      company: form.company,
      position: form.position,
      address: form.address,
    });
    ElMessage.success('资料更新成功');
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" @submit.prevent="handleSave">
    <el-form-item label="个人简介" prop="signature">
      <el-input
        v-model="form.signature"
        type="textarea"
        :rows="2"
        maxlength="200"
        show-word-limit
        placeholder="一句话介绍自己（最多 200 字）"
      />
    </el-form-item>
    <el-form-item label="生日" prop="birthday">
      <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
    </el-form-item>
    <el-form-item label="公司 / 组织" prop="company">
      <el-input v-model="form.company" maxlength="100" placeholder="选填" />
    </el-form-item>
    <el-form-item label="职位 / 岗位" prop="position">
      <el-input v-model="form.position" maxlength="50" placeholder="选填" />
    </el-form-item>
    <el-form-item label="所在地" prop="address">
      <el-input v-model="form.address" maxlength="200" placeholder="选填，如：浙江 杭州" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="saving" @click="handleSave">保存扩展资料</el-button>
    </el-form-item>
  </el-form>
</template>
