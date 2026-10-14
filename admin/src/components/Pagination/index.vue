<script setup lang="ts">
/**
 * 分页器二次封装（基于 Element Plus `el-pagination`）。
 *
 * 设计要点（相比直接套用原始示例的改进）：
 * - **响应式尺寸**：借助 `@vueuse/core` 的 `useWindowSize` 做完全响应式，视口 ≤768px 自动切 `small`，
 *   避免分页器在移动端横向溢出；无需手动 `window.addEventListener('resize')`，也就不存在监听器泄漏。
 * - **受控式封装**：父组件通过 `v-model:current-page` / `v-model:page-size` 拥有分页状态，组件只负责
 *   把 el-pagination 的事件转译为 `update:*` 与 `size-change` / `current-change`，不再用本地 ref 去镜像 prop。
 * - **切换每页条数归零页码**：`size-change` 时同步把页码重置为 1，避免切到更大每页后停留在越界页码。
 */
withDefaults(
  defineProps<{
    /** 总条数 */
    total: number;
    /** 当前页码（v-model:current-page） */
    currentPage?: number;
    /** 每页条数（v-model:page-size） */
    pageSize?: number;
    /** 可选每页条数 */
    pageSizes?: number[];
    /** 布局 */
    layout?: string;
    /** 是否带背景色 */
    background?: boolean;
  }>(),
  {
    currentPage: 1,
    pageSize: 20,
    pageSizes: () => [20, 40, 60, 80, 100],
    layout: 'total, sizes, prev, pager, next, jumper',
    background: true,
  },
);

defineOptions({ name: 'Pagination' });

const emit = defineEmits<{
  (e: 'update:currentPage', value: number): void;
  (e: 'update:pageSize', value: number): void;
  (e: 'size-change', value: number): void;
  (e: 'current-change', value: number): void;
}>();

const { width } = useWindowSize();

/** 响应式尺寸：窄屏（≤768px）使用 small，避免分页器在移动端溢出 */
const paginationSize = computed<'small' | 'default'>(() => (width.value <= 768 ? 'small' : 'default'));

/** 每页条数变化：同步回父组件，并重置到第 1 页（避免切条数后停留在越界页码） */
function handleSizeChange(size: number): void {
  emit('update:pageSize', size);
  emit('update:currentPage', 1);
  emit('size-change', size);
}

/** 页码变化 */
function handleCurrentChange(current: number): void {
  emit('update:currentPage', current);
  emit('current-change', current);
}
</script>

<template>
  <!-- 外层 el-scrollbar：移动端分页器超宽时，在自身区域内横向滚动，避免被裁剪或撑破页面布局
       （桌面端分页器能放下时不会出现滚动条） -->
  <el-scrollbar>
    <div class="pagination-container inline-flex w-max min-w-full items-center justify-end whitespace-nowrap mt-4">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="layout"
        :background="background"
        :size="paginationSize"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-scrollbar>
</template>
