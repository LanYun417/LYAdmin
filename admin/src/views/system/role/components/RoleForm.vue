<script setup lang="ts">
/** 角色新增 / 编辑弹窗。模块职责：维护角色基础信息与数据范围（含「自定义部门」的可见部门选择）。 */
import { reactive, ref, watch } from 'vue';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { createRoleApi, getRoleListApi, updateRoleApi } from '@/api/role';
import { getDeptTreeApi } from '@/api/dept';
import { useStatusDict } from '@/composables/useDict';
import { hasPermission } from '@/utils/permission';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { DATA_SCOPE_OPTIONS, type DeptNode, type RoleUpsert } from '@/types/api';

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
const deptTree = ref<DeptNode[]>([]);

/** 状态选项：数据来自字典管理中的「通用状态」（sys_common_status） */
const { statusOptions } = useStatusDict();

const defaultForm = (): RoleUpsert => ({
  roleName: '',
  roleCode: '',
  sort: 0,
  status: 1,
  dataScope: 1,
  deptIds: [],
  remark: '',
});

const form = reactive<RoleUpsert>(defaultForm());

const rules: FormRules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
};

/** 自定义部门为必选校验：选了「自定义部门」但未勾选任何部门时提示 */
function validateDeptIds(_rule: unknown, value: number[] | undefined, callback: (error?: Error) => void): void {
  if (form.dataScope === 2 && (!value || value.length === 0)) {
    callback(new Error('请选择可见部门'));
    return;
  }
  callback();
}

const rulesWithScope: FormRules = {
  ...rules,
  deptIds: [{ validator: validateDeptIds, trigger: 'change' }],
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
      dataScope: target.dataScope ?? 1,
      deptIds: target.deptIds ?? [],
      remark: target.remark ?? '',
    });
  }
}

/** 加载部门树（仅具备 system:dept:list 的角色可拉取，用于「自定义部门」选择） */
async function loadDepts(): Promise<void> {
  if (!hasPermission('system:dept:list')) {
    return;
  }
  deptTree.value = (await getDeptTreeApi()) ?? [];
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) {
      return;
    }
    resetForm();
    isEdit.value = Boolean(props.roleId);
    await loadDepts();
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
    // 非自定义部门时清空 deptIds，避免残留脏数据
    const payload = { ...form, deptIds: form.dataScope === 2 ? (form.deptIds ?? []) : [] };
    if (isEdit.value && props.roleId) {
      const { roleCode: _roleCode, ...rest } = payload;
      await updateRoleApi(props.roleId, rest);
      ElMessage.success('更新成功');
    } else {
      await createRoleApi(payload);
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
    :title="isEdit ? '编辑角色' : '新增角色'"
    width="520px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rulesWithScope" label-width="90px">
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
          <el-radio v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数据范围">
        <el-radio-group v-model="form.dataScope">
          <el-radio v-for="item in DATA_SCOPE_OPTIONS" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.dataScope === 2" label="可见部门" prop="deptIds">
        <el-tree-select
          v-model="form.deptIds"
          :data="deptTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="id"
          multiple
          show-checkbox
          check-strictly
          :render-after-expand="false"
          placeholder="勾选部门及其全部下级可见"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
