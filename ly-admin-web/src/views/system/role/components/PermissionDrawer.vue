<script setup lang="ts">
/**
 * 角色授权抽屉。
 * 模块职责：展示菜单树并保存角色已勾选的菜单 / 按钮权限；
 * 支持「从其它角色复制权限」——先在已有角色基础上回填，再做微调，省去逐项勾选。
 */

import { ElMessage } from '@/utils/element';
import { getMenuTreeApi } from '@/api/menu';
import { assignRoleMenusApi, getAllRolesApi, getRoleMenuIdsApi } from '@/api/role';
import type { MenuNode, RoleBrief } from '@/types/api';
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

/** 复制权限：全部角色（下拉数据源）、选中的来源角色、复制中标记 */
const roleOptions = ref<RoleBrief[]>([]);
const sourceRoleId = ref<number | undefined>(undefined);
const copying = ref(false);
/** 可复制的来源角色：排除当前正在授权的角色自身 */
const copyableRoles = computed(() => roleOptions.value.filter((role) => role.id !== props.roleId));

/** 抽屉响应式尺寸：桌面 420px，窄屏自动铺满，避免移动端超出屏幕 */
const { size: drawerSize } = useResponsiveSize(420);

/** 加载菜单树、已授权菜单，以及可复制的角色列表。 */
async function loadData(): Promise<void> {
  if (!props.roleId) {
    return;
  }
  loading.value = true;
  sourceRoleId.value = undefined;
  try {
    const [tree, ids, roles] = await Promise.all([
      getMenuTreeApi(),
      getRoleMenuIdsApi(props.roleId),
      // 角色下拉只服务于「复制」这一增强：拉取失败（如无 system:role:all 权限）不应挡住授权主流程，降级为空即可
      getAllRolesApi().catch(() => [] as RoleBrief[]),
    ]);
    menuTree.value = tree ?? [];
    checkedKeys.value = ids ?? [];
    roleOptions.value = roles ?? [];
  } finally {
    loading.value = false;
  }
}

/**
 * 复制来源角色的权限到当前树。
 *
 * 仅回填勾选状态、**不落库**：用户可继续勾选 / 取消做微调，点「保存」才提交。
 * 这正是「在已有角色权限基础上调整」的用法——避免先手工勾一遍再看差异。
 */
async function handleCopy(): Promise<void> {
  if (!sourceRoleId.value) {
    return;
  }
  const sourceName = copyableRoles.value.find((role) => role.id === sourceRoleId.value)?.roleName ?? '目标角色';
  copying.value = true;
  try {
    const ids = await getRoleMenuIdsApi(sourceRoleId.value);
    // 赋值即触发 MenuTree 对 defaultCheckedKeys 的精确回填（先清空再逐项 setChecked(key,true,false)）
    checkedKeys.value = ids ?? [];
    ElMessage.success(`已复制「${sourceName}」的权限，可继续微调后保存`);
  } finally {
    copying.value = false;
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
    <div class="flex h-full flex-col">
      <!-- 复制权限：选来源角色 → 回填到下方树 → 微调 → 保存。无其它角色可选时整块隐藏 -->
      <div v-if="copyableRoles.length > 0" class="mb-3 rounded-lg border border-line-lighter bg-fill-light p-3">
        <div class="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <i class="bi bi-copy" />
          <span>从其它角色复制权限</span>
        </div>
        <div class="flex items-center gap-2">
          <el-select
            v-model="sourceRoleId"
            class="flex-1"
            placeholder="选择要复制的角色"
            clearable
            filterable
            :disabled="copying"
          >
            <el-option v-for="role in copyableRoles" :key="role.id" :label="role.roleName" :value="role.id" />
          </el-select>
          <el-button type="primary" plain :disabled="!sourceRoleId" :loading="copying" @click="handleCopy">
            复制
          </el-button>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-muted">复制后可在下方继续勾选 / 取消，点「保存」才会生效。</p>
      </div>

      <!-- 滚动交给 el-scrollbar（与全局内容区一致），避免抽屉里出现原生滚动条 -->
      <el-scrollbar v-loading="loading" class="min-h-0 flex-1">
        <MenuTree ref="treeRef" :data="menuTree" :default-checked-keys="checkedKeys" />
      </el-scrollbar>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-drawer>
</template>
