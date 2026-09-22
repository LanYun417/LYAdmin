<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createRoleApi, getRoleListApi, updateRoleApi } from '@/api/role';
import type { RoleUpsert } from '@/types/api';

defineOptions({ name: 'RoleForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的角色 id */
  roleId?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);

const defaultForm = (): RoleUpsert => ({
  roleName: '',
  roleCode: '',
  sort: 0,
  status: 1,
  remark: '',
});

const form = reactive<RoleUpsert>(defaultForm());

const rules: FormRules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
};

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载角色详情 */
async function loadDetail(id: number): Promise<void> {
  const res = await getRoleListApi({ page: 1, pageSize: 100 });
  const target = res.list.find((role) => role.id === id);
  if (target) {
    Object.assign(form, {
      roleName: target.roleName,
      roleCode: target.roleCode,
      sort: target.sort,
      status: target.status,
      remark: target.remark ?? '',
    });
  }
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) {
      return;
    }
    resetForm();
    isEdit.value = Boolean(props.roleId);
    if (props.roleId) {
      await loadDetail(props.roleId);
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
    if (isEdit.value && props.roleId) {
      const { roleCode: _roleCode, ...rest } = form;
      await updateRoleApi(props.roleId, rest);
      ElMessage.success('更新成功');
    } else {
      await createRoleApi({ ...form });
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
  <el-dialog :model-value="modelValue" :title="isEdit ? '编辑角色' : '新增角色'" width="480px" @close="handleClose">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="角色名称" prop="roleName">
        <el-input v-model="form.roleName" placeholder="请输入角色名称" />
      </el-form-item>
      <el-form-item label="角色编码" prop="roleCode">
        <el-input v-model="form.roleCode" :disabled="isEdit" placeholder="如 admin" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" :max="9999" />
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

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
