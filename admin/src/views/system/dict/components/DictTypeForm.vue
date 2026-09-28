<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createDictTypeApi, updateDictTypeApi } from '@/api/dict';
import { clearDictCache } from '@/hooks/useDict';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { DictType, DictTypeUpsert } from '@/types/api';

defineOptions({ name: 'DictTypeForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的目标行；为空表示新增 */
  row?: DictType | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);

const defaultForm = (): DictTypeUpsert => ({
  dictName: '',
  dictType: '',
  status: 1,
  remark: '',
});

const form = reactive<DictTypeUpsert>(defaultForm());

const rules: FormRules = {
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
  dictType: [
    { required: true, message: '请输入字典类型编码', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_]{1,99}$/,
      message: '字母开头，2~100 位字母/数字/下划线',
      trigger: 'blur',
    },
  ],
};

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return;
    }
    resetForm();
    isEdit.value = Boolean(props.row);
    if (props.row) {
      Object.assign(form, {
        dictName: props.row.dictName,
        dictType: props.row.dictType,
        status: props.row.status,
        remark: props.row.remark ?? '',
      });
    }
  },
);

/** 关闭 */
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
    if (isEdit.value && props.row) {
      // 类型编码不可修改，编辑时不提交 dictType
      await updateDictTypeApi(props.row.id, {
        dictName: form.dictName,
        status: form.status,
        remark: form.remark,
      });
      ElMessage.success('更新成功');
    } else {
      await createDictTypeApi({ ...form });
      ElMessage.success('新增成功');
    }
    // 类型的启停会直接影响业务取数结果，清空字典缓存
    clearDictCache();
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
    :title="isEdit ? '编辑字典类型' : '新增字典类型'"
    width="520px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="字典名称" prop="dictName">
        <el-input v-model="form.dictName" placeholder="请输入字典名称，如 用户性别" />
      </el-form-item>
      <el-form-item label="类型编码" prop="dictType">
        <el-input v-model="form.dictType" :disabled="isEdit" placeholder="如 sys_user_sex（创建后不可修改）" />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio :value="1">启用</el-radio>
          <el-radio :value="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
