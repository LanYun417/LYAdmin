<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/element';
import { assignUserRolesApi } from '@/api/user';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { RoleBrief } from '@/types/api';

defineOptions({ name: 'AssignRoleDialog' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 目标用户 id */
  userId?: number;
  /** 当前已选角色 */
  roleIds: number[];
  /** 可选角色 */
  roleOptions: RoleBrief[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const selected = ref<number[]>([]);
const submitting = ref(false);

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      selected.value = [...props.roleIds];
    }
  },
);

/** 关闭 */
function handleClose(): void {
  emit('update:modelValue', false);
}

/** 提交 */
async function handleSubmit(): Promise<void> {
  if (!props.userId) {
    return;
  }
  submitting.value = true;
  try {
    await assignUserRolesApi(props.userId, selected.value);
    ElMessage.success('分配成功');
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
    title="分配角色"
    width="480px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-checkbox-group v-model="selected">
      <div class="role-list flex flex-col gap-2">
        <el-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id" :label="role.roleName" />
      </div>
    </el-checkbox-group>
  </BasicDialog>
</template>
