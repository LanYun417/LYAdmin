<script setup lang="ts">
/**
 * 用户额外权限抽屉。
 * 模块职责：在用户「角色权限」之上做**只针对该用户**的额外授予 / 额外撤销，
 * 不影响其所属角色下的其他人（改角色会波及全员，这正是本功能要解决的问题）。
 *
 * 交互：树按「最终有效集合」回填；勾选 = 额外授予，取消角色自带的项 = 额外撤销。
 * 保存时把整棵树的勾选结果发给后端，由后端与角色自带集合求差得出授予 / 撤销。
 */

import { ElMessage } from '@/utils/element';
import { getMenuTreeApi } from '@/api/menu';
import { assignUserMenusApi, getUserMenusApi } from '@/api/user';
import type { MenuNode } from '@/types/api';
import MenuTree from '@/components/MenuTree/index.vue';
import { useResponsiveSize } from '@/composables/useResponsiveSize';

defineOptions({ name: 'UserPermissionDrawer' });

const props = defineProps<{
  /** 抽屉可见性 */
  modelValue: boolean;
  /** 用户 id */
  userId?: number;
  /** 用户展示名（用户名 / 昵称） */
  userName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const menuTree = ref<MenuNode[]>([]);
/** 角色自带菜单（基线，用于打「角色」标签与实时统计） */
const roleMenuIds = ref<number[]>([]);
/** 回填用的勾选集合 */
const checkedKeys = ref<number[]>([]);
/** 当前实时勾选集合（跟着树变化，仅用于统计授予/撤销数） */
const liveChecked = ref<Set<number>>(new Set());
const loading = ref(false);
const submitting = ref(false);
const treeRef = ref<InstanceType<typeof MenuTree>>();

const { size: drawerSize } = useResponsiveSize(460);

const roleSet = computed(() => new Set(roleMenuIds.value));
/** 相对角色基线：额外授予数量 */
const grantedCount = computed(() => Array.from(liveChecked.value).filter((id) => !roleSet.value.has(id)).length);
/** 相对角色基线：额外撤销数量 */
const revokedCount = computed(() => roleMenuIds.value.filter((id) => !liveChecked.value.has(id)).length);

/** 加载菜单树与该用户的权限概况 */
async function loadData(): Promise<void> {
  if (!props.userId) {
    return;
  }
  loading.value = true;
  try {
    const [tree, overview] = await Promise.all([getMenuTreeApi(), getUserMenusApi(props.userId)]);
    menuTree.value = tree ?? [];
    roleMenuIds.value = overview?.roleMenuIds ?? [];
    const effective = overview?.effectiveMenuIds ?? [];
    checkedKeys.value = effective;
    liveChecked.value = new Set(effective);
  } finally {
    loading.value = false;
  }
}

/** 树勾选变化：仅刷新统计，不改变保存口径 */
function handleCheck(checked: number[], half: number[]): void {
  liveChecked.value = new Set([...checked, ...half]);
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

/** 保存：把最终有效集合发给后端，由后端求差得出额外授予 / 撤销 */
async function handleSubmit(): Promise<void> {
  if (!props.userId || !treeRef.value) {
    return;
  }
  submitting.value = true;
  try {
    const checked = treeRef.value.getCheckedKeys();
    const half = treeRef.value.getHalfCheckedKeys();
    await assignUserMenusApi(props.userId, [...checked, ...half]);
    ElMessage.success('额外权限保存成功');
    emit('success');
    handleClose();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="`额外权限 - ${userName}`" :size="drawerSize" @close="handleClose">
    <div class="flex h-full flex-col">
      <div
        class="mb-3 rounded-lg border border-line-lighter bg-fill-light p-3 text-xs leading-relaxed text-ink-regular"
      >
        <p class="mb-1 text-[13px] font-semibold text-ink">只对「{{ userName }}」生效，不影响其角色下的其他人</p>
        <p>勾选 = 额外授予；取消角色自带的项 = 对该用户单独撤销（带「角色」标签的为角色自带）。</p>
        <p class="mt-1 text-muted">
          角色自带 {{ roleMenuIds.length }} 项<span v-if="grantedCount">，额外授予 {{ grantedCount }} 项</span
          ><span v-if="revokedCount">，额外撤销 {{ revokedCount }} 项</span>
        </p>
      </div>

      <!-- 滚动交给 el-scrollbar（与全局内容区一致），避免抽屉里出现原生滚动条 -->
      <el-scrollbar v-loading="loading" class="min-h-0 flex-1">
        <MenuTree
          ref="treeRef"
          :data="menuTree"
          :default-checked-keys="checkedKeys"
          :mark-keys="roleMenuIds"
          @check="handleCheck"
        />
      </el-scrollbar>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-drawer>
</template>
