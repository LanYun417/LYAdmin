<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { MenuNode } from '@/types/api';

defineOptions({ name: 'MenuTree' });

const props = withDefaults(
  defineProps<{
    /** 树数据 */
    data: MenuNode[];
    /** 是否父子不关联 */
    checkStrictly?: boolean;
    /** 默认勾选的 key */
    defaultCheckedKeys?: number[];
    /** 是否显示复选框 */
    showCheckbox?: boolean;
    /** 节点 key 字段 */
    nodeKey?: string;
    /** 字段映射 */
    treeProps?: { label: string; children: string };
  }>(),
  {
    checkStrictly: false,
    defaultCheckedKeys: () => [],
    showCheckbox: true,
    nodeKey: 'id',
    treeProps: () => ({ label: 'menuName', children: 'children' }),
  },
);

const emit = defineEmits<{
  (e: 'check', checkedKeys: number[], halfCheckedKeys: number[]): void;
}>();

/** el-tree 暴露的方法（最小接口） */
interface TreeExpose {
  getCheckedKeys: (leafOnly?: boolean) => Array<string | number>;
  getHalfCheckedKeys: () => Array<string | number>;
  setCheckedKeys: (keys: Array<string | number>, leafOnly?: boolean) => void;
  setCurrentKey: (key?: string | number | null) => void;
}

const treeRef = ref<TreeExpose>();

/** 勾选变化 */
function handleCheck(): void {
  if (!treeRef.value) {
    return;
  }
  const checked = treeRef.value.getCheckedKeys() as number[];
  const half = treeRef.value.getHalfCheckedKeys() as number[];
  emit('check', checked, half);
}

/** 设置勾选节点 */
function setCheckedKeys(keys: number[]): void {
  void nextTick(() => {
    treeRef.value?.setCheckedKeys(keys);
  });
}

/** 获取勾选节点 */
function getCheckedKeys(): number[] {
  return (treeRef.value?.getCheckedKeys() as number[]) ?? [];
}

/** 获取半选节点 */
function getHalfCheckedKeys(): number[] {
  return (treeRef.value?.getHalfCheckedKeys() as number[]) ?? [];
}

watch(
  () => props.defaultCheckedKeys,
  (keys) => {
    setCheckedKeys(keys);
  },
  { immediate: true, deep: true },
);

defineExpose({ setCheckedKeys, getCheckedKeys, getHalfCheckedKeys, treeRef });
</script>

<template>
  <el-tree
    ref="treeRef"
    :data="data"
    :props="treeProps"
    :node-key="nodeKey"
    :show-checkbox="showCheckbox"
    :check-strictly="checkStrictly"
    :default-expand-all="true"
    :default-checked-keys="defaultCheckedKeys"
    highlight-current
    @check="handleCheck"
  />
</template>
