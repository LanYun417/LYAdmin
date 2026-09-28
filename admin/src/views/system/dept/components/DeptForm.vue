<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createDeptApi, getDeptDetailApi, getDeptTreeApi, updateDeptApi } from '@/api/dept';
import { useStatusDict } from '@/hooks/useDict';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { DeptNode, DeptUpsert } from '@/types/api';

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

const defaultForm = (): DeptUpsert => ({
  parentId: 0,
  deptName: '',
  leader: '',
  phone: '',
  email: '',
  sort: 0,
  status: 1,
});

const form = reactive<DeptUpsert>(defaultForm());

const rules: FormRules = {
  deptName: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
};

/** 过滤掉自身及其子树，避免上级选择成环（含虚拟根节点） */
function filterSelf(nodes: DeptNode[], selfId?: number): DeptNode[] {
  return nodes
    .filter((node) => node.id !== selfId)
    .map((node) => ({
      ...node,
      children: node.children ? filterSelf(node.children, selfId) : [],
    }));
}

/** 上级选择树（含虚拟根节点「顶级部门」） */
const parentTree = computed<DeptNode[]>(() => {
  const filtered = filterSelf(deptTree.value, props.deptId);
  return [
    {
      id: 0,
      parentId: -1,
      deptName: '顶级部门',
      sort: 0,
      status: 1,
      leader: null,
      phone: null,
      email: null,
      children: filtered,
    },
  ];
});

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
    if (isEdit.value && props.deptId) {
      await updateDeptApi(props.deptId, { ...form });
      ElMessage.success('更新成功');
    } else {
      await createDeptApi({ ...form });
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
      <el-form-item label="上级部门">
        <el-tree-select
          v-model="form.parentId"
          :data="parentTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="id"
          check-strictly
          :render-after-expand="false"
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
