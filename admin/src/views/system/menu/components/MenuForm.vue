<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createMenuApi, getMenuDetailApi, getMenuTreeApi, updateMenuApi } from '@/api/menu';
import { useStatusDict } from '@/hooks/useDict';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { MenuNode, MenuUpsert } from '@/types/api';
import IconSelect from './IconSelect.vue';

defineOptions({ name: 'MenuForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的菜单 id */
  menuId?: number;
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
const menuTree = ref<MenuNode[]>([]);

const defaultForm = (): MenuUpsert => ({
  parentId: 0,
  menuName: '',
  menuType: 'C',
  path: '',
  component: '',
  icon: '',
  permission: '',
  sort: 0,
  visible: 1,
  status: 1,
  redirect: '',
  keepAlive: 0,
});

const form = reactive<MenuUpsert>(defaultForm());

const rules: FormRules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择菜单类型', trigger: 'change' }],
};

/** 过滤掉自身及其子树，避免父级选择成环 */
function filterSelf(nodes: MenuNode[], selfId?: number): MenuNode[] {
  return nodes
    .filter((node) => node.id !== selfId)
    .map((node) => ({
      ...node,
      children: node.children ? filterSelf(node.children, selfId) : [],
    }));
}

/** 父级选择树（含虚拟根节点） */
const parentTree = computed<MenuNode[]>(() => {
  const filtered = filterSelf(menuTree.value, props.menuId);
  return [
    {
      id: 0,
      parentId: -1,
      menuName: '顶级菜单',
      menuType: 'M',
      sort: 0,
      visible: 1,
      status: 1,
      keepAlive: 0,
      children: filtered,
    },
  ];
});

/** 是否为目录 / 菜单 / 按钮 */
const isDirectory = computed(() => form.menuType === 'M');
const isMenu = computed(() => form.menuType === 'C');
const isButton = computed(() => form.menuType === 'F');

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载菜单树与详情 */
async function loadData(): Promise<void> {
  const tree = await getMenuTreeApi();
  menuTree.value = tree ?? [];
  if (props.menuId) {
    const detail = await getMenuDetailApi(props.menuId);
    Object.assign(form, {
      parentId: detail.parentId,
      menuName: detail.menuName,
      menuType: detail.menuType,
      path: detail.path ?? '',
      component: detail.component ?? '',
      icon: detail.icon ?? '',
      permission: detail.permission ?? '',
      sort: detail.sort,
      visible: detail.visible,
      status: detail.status,
      redirect: detail.redirect ?? '',
      keepAlive: detail.keepAlive,
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
    isEdit.value = Boolean(props.menuId);
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
    if (isEdit.value && props.menuId) {
      await updateMenuApi(props.menuId, { ...form });
      ElMessage.success('更新成功');
    } else {
      await createMenuApi({ ...form });
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
    :title="isEdit ? '编辑菜单' : '新增菜单'"
    width="620px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="上级菜单">
        <el-tree-select
          v-model="form.parentId"
          :data="parentTree"
          :props="{ label: 'menuName', children: 'children' }"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="菜单类型" prop="menuType">
        <el-radio-group v-model="form.menuType">
          <el-radio value="M">目录</el-radio>
          <el-radio value="C">菜单</el-radio>
          <el-radio value="F">按钮</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="菜单名称" prop="menuName">
        <el-input v-model="form.menuName" placeholder="请输入菜单名称" />
      </el-form-item>
      <el-form-item v-if="!isButton" label="路由路径">
        <el-input v-model="form.path" placeholder="如 user 或 /system/user" />
      </el-form-item>
      <el-form-item v-if="isMenu" label="组件路径">
        <el-input v-model="form.component" placeholder="如 system/user/index" />
      </el-form-item>
      <el-form-item v-if="!isButton" label="菜单图标">
        <IconSelect v-model="form.icon" />
      </el-form-item>
      <el-form-item v-if="!isDirectory" label="权限标识">
        <el-input v-model="form.permission" placeholder="如 system:user:add" />
      </el-form-item>
      <el-form-item v-if="isDirectory" label="重定向">
        <el-input v-model="form.redirect" placeholder="如 /system/user" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item v-if="isMenu" label="是否缓存">
        <el-switch v-model="form.keepAlive" :active-value="1" :inactive-value="0" />
      </el-form-item>
      <el-form-item v-if="!isButton" label="是否显示">
        <el-switch v-model="form.visible" :active-value="1" :inactive-value="0" />
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
  </BasicDialog>
</template>
