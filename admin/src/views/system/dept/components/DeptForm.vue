<script setup lang="ts">
/** 部门新增 / 编辑弹窗。模块职责：维护部门信息与上级归属，并避免层级选择成环。 */
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { createDeptApi, getDeptDetailApi, getDeptTreeApi, updateDeptApi } from '@/api/dept';
import { useStatusDict } from '@/composables/useDict';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { DeptNode, DeptUpsert } from '@/types/api';

/**
 * 表单内部数据模型。
 * `parentId` 为 `null` 表示未选择上级；提交时归一为 0（顶级部门）。
 */
interface DeptFormModel extends Omit<DeptUpsert, 'parentId'> {
  parentId: number | null;
}

defineOptions({ name: 'DeptForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的部门 id */
  deptId?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

/** 状态选项：数据来自字典管理中的「通用状态」（sys_common_status） */
const { statusOptions } = useStatusDict();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);
const deptTree = ref<DeptNode[]>([]);

const defaultForm = (): DeptFormModel => ({
  parentId: null,
  deptName: '',
  leader: '',
  phone: '',
  email: '',
  sort: 0,
  status: 1,
});

const form = reactive<DeptFormModel>(defaultForm());

const rules: FormRules = {
  deptName: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
  // 字段隐藏时（无可选上级）不参与校验，此时提交即为顶级部门
  parentId: [{ required: true, message: '请选择上级部门', trigger: 'change' }],
};

/** 过滤掉自身及其子树，避免上级选择成环 */
function filterSelf(nodes: DeptNode[], selfId?: number): DeptNode[] {
  return nodes
    .filter((node) => node.id !== selfId)
    .map((node) => ({
      ...node,
      children: node.children ? filterSelf(node.children, selfId) : [],
    }));
}

/** 可选的上级部门树（真实部门，剔除自身及其子树） */
const parentOptions = computed<DeptNode[]>(() => filterSelf(deptTree.value, props.deptId));

/**
 * 是否展示「上级部门」字段。
 * 规则：仅当存在可选上级时才展示 —— 首次新增（尚无任何部门）或编辑顶级部门（parentId=0）时隐藏，
 * 这种情况下该部门就是顶级部门，直接用公司名称命名即可。
 */
const showParentField = computed<boolean>(() => form.parentId !== 0 && parentOptions.value.length > 0);

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载部门树与详情 */
async function loadData(): Promise<void> {
  const tree = await getDeptTreeApi();
  deptTree.value = tree ?? [];
  if (props.deptId) {
    const detail = await getDeptDetailApi(props.deptId);
    Object.assign(form, {
      parentId: detail.parentId,
      deptName: detail.deptName,
      leader: detail.leader ?? '',
      phone: detail.phone ?? '',
      email: detail.email ?? '',
      sort: detail.sort,
      status: detail.status,
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
    isEdit.value = Boolean(props.deptId);
    await loadData();
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
    // parentId 为 null（未选择上级 / 首次新增）时归一为 0，即顶级部门
    const payload: DeptUpsert = { ...form, parentId: form.parentId ?? 0 };
    if (isEdit.value && props.deptId) {
      await updateDeptApi(props.deptId, payload);
      ElMessage.success('更新成功');
    } else {
      await createDeptApi(payload);
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
    :title="isEdit ? '编辑部门' : '新增部门'"
    width="560px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item v-if="showParentField" label="上级部门" prop="parentId">
        <el-tree-select
          v-model="form.parentId"
          :data="parentOptions"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          placeholder="请选择上级部门"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="部门名称" prop="deptName">
        <el-input v-model="form.deptName" placeholder="请输入部门名称" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="form.leader" placeholder="请输入负责人" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.phone" placeholder="请输入联系电话" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="form.email" placeholder="请输入邮箱" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
