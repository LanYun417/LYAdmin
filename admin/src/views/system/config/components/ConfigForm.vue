<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { createConfigApi, getConfigDetailApi, updateConfigApi } from '@/api/config';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { ConfigUpsert } from '@/types/api';

defineOptions({ name: 'ConfigForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的参数 id（为空表示新增） */
  configId?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);

const defaultForm = (): ConfigUpsert => ({
  configName: '',
  configKey: '',
  configValue: '',
  remark: '',
});

const form = reactive<ConfigUpsert>(defaultForm());

const rules: FormRules = {
  configName: [{ required: true, message: '请输入参数名称', trigger: 'blur' }],
  configKey: [
    { required: true, message: '请输入参数键名', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9._]{1,99}$/,
      message: '字母开头，2~100 位字母/数字/点/下划线',
      trigger: 'blur',
    },
  ],
};

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载参数详情 */
async function loadDetail(id: number): Promise<void> {
  const detail = await getConfigDetailApi(id);
  Object.assign(form, {
    configName: detail.configName,
    configKey: detail.configKey,
    configValue: detail.configValue,
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
    isEdit.value = Boolean(props.configId);
    if (props.configId) {
      await loadDetail(props.configId);
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
    if (isEdit.value && props.configId) {
      const { configKey: _configKey, ...rest } = form;
      await updateConfigApi(props.configId, rest);
      ElMessage.success('更新成功');
    } else {
      await createConfigApi({ ...form });
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
    :title="isEdit ? '编辑参数' : '新增参数'"
    width="560px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="参数名称" prop="configName">
        <el-input v-model="form.configName" placeholder="请输入参数名称" />
      </el-form-item>
      <el-form-item label="参数键名" prop="configKey">
        <el-input v-model="form.configKey" :disabled="isEdit" placeholder="如 sys.page.watermark" />
      </el-form-item>
      <el-form-item label="参数值" prop="configValue">
        <el-input v-model="form.configValue" type="textarea" :rows="2" placeholder="请输入参数值" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
