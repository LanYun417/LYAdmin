<script setup lang="ts">
import { computed } from 'vue';
import type { MenuNode } from '@/types/api';

defineOptions({ name: 'SidebarItem' });

const props = defineProps<{
  /** 菜单节点 */
  item: MenuNode;
  /** 父级完整路径 */
  basePath: string;
}>();

/** 拼接完整路径 */
function resolvePath(routePath?: string | null): string {
  if (!routePath) {
    return props.basePath;
  }
  if (/^https?:\/\//.test(routePath)) {
    return routePath;
  }
  if (routePath.startsWith('/')) {
    return routePath;
  }
  return `${props.basePath}/${routePath}`.replace(/\/{2,}/g, '/');
}

/** 可见子菜单（过滤按钮与禁用项） */
const visibleChildren = computed(() =>
  (props.item.children ?? []).filter((child) => child.menuType !== 'F' && child.status !== 0 && child.visible !== 0),
);

/** 是否叶子节点 */
const isLeaf = computed(() => visibleChildren.value.length === 0);

/** 当前节点完整路径 */
const fullPath = computed(() => resolvePath(props.item.path));
</script>

<template>
  <el-sub-menu v-if="!isLeaf" :index="fullPath">
    <template #title>
      <el-icon v-if="item.icon">
        <component :is="item.icon" />
      </el-icon>
      <span>{{ item.menuName }}</span>
    </template>
    <SidebarItem v-for="child in visibleChildren" :key="child.id" :item="child" :base-path="fullPath" />
  </el-sub-menu>

  <el-menu-item v-else :index="fullPath">
    <el-icon v-if="item.icon">
      <component :is="item.icon" />
    </el-icon>
    <template #title>
      <span>{{ item.menuName }}</span>
    </template>
  </el-menu-item>
</template>
