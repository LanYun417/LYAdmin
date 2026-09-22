<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 总条数 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页条数 */
    pageSize: number;
    /** 可选的每页条数 */
    pageSizes?: number[];
    /** 布局 */
    layout?: string;
    /** 是否带背景色 */
    background?: boolean;
  }>(),
  {
    pageSizes: () => [10, 20, 30, 50, 100],
    layout: 'total, sizes, prev, pager, next, jumper',
    background: true,
  },
);

defineOptions({ name: 'Pagination' });

const emit = defineEmits<{
  (e: 'update:page', value: number): void;
  (e: 'update:pageSize', value: number): void;
  (e: 'change'): void;
}>();

/** 每页条数变化 */
function handleSizeChange(size: number): void {
  emit('update:pageSize', size);
  emit('update:page', 1);
  emit('change');
}

/** 页码变化 */
function handleCurrentChange(current: number): void {
  emit('update:page', current);
  emit('change');
}
</script>

<template>
  <div class="pagination-container flex justify-end mt-4">
    <el-pagination
      :total="total"
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :layout="layout"
      :background="background"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>
