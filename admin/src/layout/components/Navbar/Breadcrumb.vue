<script setup lang="ts">
import type { BreadcrumbItem } from '@/types/router';

defineOptions({ name: 'Breadcrumb' });

const route = useRoute();

/** 依据 route.matched 生成动态面包屑 */
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const matched = route.matched.filter((item) => item.meta && item.meta.title);
  return matched.map((item) => ({
    title: item.meta.title as string,
    path: item.path,
    redirect: item.redirect as string | undefined,
  }));
});
</script>

<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item
      v-for="(item, index) in breadcrumbs"
      :key="item.path"
      :to="index < breadcrumbs.length - 1 ? { path: item.redirect || item.path } : undefined"
    >
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
