<script setup lang="ts">
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
  /** 设置单个节点的勾选；`deep=false` 时不联动子节点 */
  setChecked: (dataOrKey: string | number, checked: boolean, deep?: boolean) => void;
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

/**
 * 回填勾选状态。
 *
 * ⚠️ **不能直接调 `setCheckedKeys(keys)`**：el-tree 的 `_setCheckedKeys` 对列表里的
 * **非叶子**节点执行 `setChecked(true, true)`（深度级联），且被级联勾上的子孙会被内部 `cache`
 * 保护、不会被后续循环取消。而角色授权保存的是「勾选 + 半选」——半选的父级一旦进入列表，
 * 它下面**所有**子孙都会被补成勾选。实测（真实菜单树 + 只读访客角色）：
 * 服务端 13 个 id → 回填后变成 **50 个勾选**（多出「系统管理」下未授权的按钮），
 * 于是用户取消的权限一重开就"自己回来了"，看起来就是"保存不生效"。
 *
 * 正解：先清空，再**逐个** `setChecked(key, true, false)`：
 * - `deep=false` 不向下联动，所以"父级授权但子项未授权"也能如实还原；
 * - `node.setChecked` 末尾会自动 `reInitChecked(parent)`，父级的全选 / 半选状态照样算对。
 * 同样的数据这样回填得到 11 勾选 + 2 半选，与服务端完全一致。
 */
function setCheckedKeys(keys: number[]): void {
  void nextTick(() => {
    const tree = treeRef.value;
    if (!tree) {
      return;
    }
    tree.setCheckedKeys([]);
    for (const key of keys) {
      tree.setChecked(key, true, false);
    }
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
  <!--
    刻意不传 `:default-checked-keys`：el-tree 初始化时对默认勾选同样走级联
    （`setChecked(true, !checkStrictly)`），会和上面的精确回填冲突。
    回填只保留 {@link setCheckedKeys} 这一条路径，避免两套逻辑互相覆盖。
  -->
  <el-tree
    ref="treeRef"
    :data="data"
    :props="treeProps"
    :node-key="nodeKey"
    :show-checkbox="showCheckbox"
    :check-strictly="checkStrictly"
    :default-expand-all="true"
    highlight-current
    @check="handleCheck"
  />
</template>
