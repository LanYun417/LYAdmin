<script setup lang="ts">
/** 角色授权抽屉。模块职责：展示菜单树并保存角色已勾选的菜单 / 按钮权限。 */

import { ElMessage } from '@/utils/element';
import { getMenuTreeApi } from '@/api/menu';
import { assignRoleMenusApi, getRoleMenuIdsApi } from '@/api/role';
import type { MenuNode } from '@/types/api';
import MenuTree from '@/components/MenuTree/index.vue';
import { useResponsiveSize } from '@/composables/useResponsiveSize';

defineOptions({ name: 'PermissionDrawer' });

const props = defineProps<{
  /** 抽屉可见性 */
  modelValue: boolean;
  /** 角色 id */
  roleId?: number;
  /** 角色名称 */
  roleName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const menuTree = ref<MenuNode[]>([]);
const checkedKeys = ref<number[]>([]);
const loading = ref(false);
const submitting = ref(false);
const treeRef = ref<InstanceType<typeof MenuTree>>();

/** 抽屉响应式尺寸：桌面 420px，窄屏自动铺满，避免移动端超出屏幕 */
const { size: drawerSize } = useResponsiveSize(420);

/** 加载菜单树与已授权菜单 */
async function loadData(): Promise<void> {
  if (!props.roleId) {
    return;
  }
  loading.value = true;
  try {
    const [tree, ids] = await Promise.all([getMenuTreeApi(), getRoleMenuIdsApi(props.roleId)]);
    menuTree.value = tree ?? [];
    checkedKeys.value = ids ?? [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      void loadData();
    }
  },
);

/** 关闭 */
function handleClose(): void {
  emit('update:modelValue', false);
}

/** 保存授权 */
async function handleSubmit(): Promise<void> {
  if (!props.roleId || !treeRef.value) {
    return;
  }
  submitting.value = true;
  try {
    const checked = treeRef.value.getCheckedKeys();
    const half = treeRef.value.getHalfCheckedKeys();
    await assignRoleMenusApi(props.roleId, [...checked, ...half]);
    ElMessage.success('授权成功');
    emit('success');
    handleClose();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="`分配权限 - ${roleName}`" :size="drawerSize" @close="handleClose">
    <!-- 滚动交给 el-scrollbar（与全局内容区一致），避免抽屉里出现原生滚动条 -->
    <el-scrollbar v-loading="loading" class="h-full">
      <MenuTree ref="treeRef" :data="menuTree" :default-checked-keys="checkedKeys" />
    </el-scrollbar>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-drawer>
</template>
