<script setup lang="ts">
/**
 * 列表页骨架：筛选栏 + 卡片头（标题/工具按钮）+ 表格 + 分页。
 *
 * 设计目标（与普通页面最大的差别）：**整块高度恰好撑满内容区，只有表体内部滚动**。
 *   ┌ 内容区可视高度 ────────────────────────────────┐
 *   │ ① 筛选栏（#filter）        固定，高度随换行自适应 │
 *   │ ② 卡片头（标题 + #toolbar） 固定                  │
 *   │ ③ 表格区  height = ① ② ④ 之外的剩余             │
 *   │    表头固定、表体内部滚动（el-table 的 height）   │
 *   │ ④ 分页                     固定                   │
 *   └──────────────────────────────────────────────────┘
 *
 * 为什么用「JS 量出像素」而不是 `height: 100%` / `max-height: 100%`：
 * 内容区的滚动容器是 `el-scrollbar`，其 `.el-scrollbar__view` 为 `display:inline-block`，
 * 高度由内容撑开。表格用百分比高度会解析成「相对一个由内容决定高度的父级」→ 循环依赖 → 0，
 * 表头与表体一起塌陷（本项目在字典项抽屉上踩过两次）。此处直接算出可用像素再传给
 * `el-table` 的 `height`，父级高度确定，固定列 / 表头固定 / 表体滚动都由 Element Plus 原生负责。
 *
 * 兜底：可视高度不足 `minHeight`（矮屏 / 移动端横屏）时按 `minHeight` 渲染，允许整页滚动，
 * 避免表格被压成只剩表头。
 */
import { useElementSize } from '@vueuse/core';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import { useFillContentHeight } from '@/composables/useFillContentHeight';

defineOptions({ name: 'TablePage', inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** 卡片标题（不需要时可留空，仅用 #toolbar 插槽） */
    title?: string;
    /** 表格加载态 */
    loading?: boolean;
    /** 总条数 */
    total?: number;
    /** 当前页码（v-model:current-page） */
    currentPage?: number;
    /** 每页条数（v-model:page-size） */
    pageSize?: number;
    /** 可选每页条数 */
    pageSizes?: number[];
    /** 分页布局 */
    paginationLayout?: string;
    /** 是否显示分页（如不分页的详情列表可关闭） */
    showPagination?: boolean;
    /** 整块最小高度：可视区不足时按此高度渲染并允许整页滚动 */
    minHeight?: number;
    /** 表格最小高度：避免筛选栏占满后表格被压没 */
    tableMinHeight?: number;
  }>(),
  {
    title: '',
    loading: false,
    total: 0,
    currentPage: 1,
    pageSize: 20,
    pageSizes: () => [20, 40, 60, 80, 100],
    paginationLayout: 'total, sizes, prev, pager, next, jumper',
    showPagination: true,
    minHeight: 480,
    tableMinHeight: 160,
  },
);

const emit = defineEmits<{
  (e: 'search'): void;
  (e: 'reset'): void;
  (e: 'update:currentPage', value: number): void;
  (e: 'update:pageSize', value: number): void;
  (e: 'size-change', value: number): void;
  (e: 'current-change', value: number): void;
}>();

/** 表格容器：其尺寸变化会驱动 el-table 的 height */
const tableWrapRef = ref<HTMLElement>();
/** 表格实例（供调用方做 clearSelection / toggleRowSelection 等） */
const tableRef = ref<{ doLayout?: () => void; clearSelection?: () => void }>();

/** 整块高度：统一由 useFillContentHeight 实测（与代码生成页共用同一套口径） */
const { rootRef, rootHeight, measure } = useFillContentHeight({ minHeight: props.minHeight });

const { height: wrapHeight } = useElementSize(tableWrapRef);

/**
 * 传给 el-table 的高度。
 * 用 `Math.max(..., tableMinHeight)` 兜底：容器被筛选栏挤得很小时，表格仍保有可用的最小高度，
 * 超出部分由外层 `overflow: hidden` 裁掉（此时整块已按 minHeight 兜底，允许整页滚动）。
 */
const tableHeight = computed(() => Math.max(Math.floor(wrapHeight.value || 0), props.tableMinHeight));

// 高度变化后让 el-table 重算列宽/固定列布局（否则固定列会停在旧位置）
watch(tableHeight, async () => {
  await nextTick();
  tableRef.value?.doLayout?.();
});

/** 供父组件在「列显隐切换 / 数据变化」后手动重排 */
function refreshLayout(): void {
  void nextTick(() => tableRef.value?.doLayout?.());
}

defineExpose({ tableRef, refreshLayout, measure });
</script>

<template>
  <div ref="rootRef" class="table-page flex flex-col" :style="{ height: rootHeight ? `${rootHeight}px` : undefined }">
    <!-- ① 筛选栏：有 #filter 才渲染，高度随内容自适应（窄屏换行时表格区自动让位） -->
    <div v-if="$slots.filter" class="table-page__filter shrink-0">
      <SearchForm @search="emit('search')" @reset="emit('reset')">
        <slot name="filter" />
        <!-- 高级筛选（如登录/操作日志的时间范围），透传给 SearchForm 的 #advanced -->
        <template v-if="$slots.filterAdvanced" #advanced>
          <slot name="filterAdvanced" />
        </template>
      </SearchForm>
    </div>

    <!-- ②③④ 卡片：撑满剩余高度，内部再切成「头 / 表 / 分页」三段 -->
    <el-card class="table-page__card min-h-0 flex-1" shadow="never">
      <div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-y-2">
        <div class="flex min-w-0 items-center gap-2">
          <slot name="title">
            <span v-if="title" class="text-[15px] font-semibold text-ink">{{ title }}</span>
          </slot>
        </div>
        <div v-if="$slots.toolbar" class="flex flex-wrap items-center gap-2">
          <slot name="toolbar" />
        </div>
      </div>

      <!-- ③ 表格区：吃掉剩余高度，溢出裁掉；表体滚动由 el-table 自己负责。
           data / selection-change 等表格配置经 $attrs 透传（组件只管骨架与高度）。 -->
      <div ref="tableWrapRef" class="min-h-0 flex-1 overflow-hidden">
        <el-table ref="tableRef" v-bind="$attrs" v-loading="loading" :height="tableHeight" border>
          <slot />
          <template v-if="$slots.empty" #empty>
            <slot name="empty" />
          </template>
        </el-table>
      </div>

      <!-- ④ 分页：固定高度，不参与剩余空间分配（Pagination 自身已处理 flex: none） -->
      <Pagination
        v-if="showPagination"
        class="shrink-0"
        :total="total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        @update:current-page="emit('update:currentPage', $event)"
        @update:page-size="emit('update:pageSize', $event)"
        @size-change="emit('size-change', $event)"
        @current-change="emit('current-change', $event)"
      />
    </el-card>
  </div>
</template>

<style scoped>
/* 卡片需要能撑满父级，el-card 默认 height:auto */
.table-page__card {
  display: flex;
  flex-direction: column;
}

/* el-card 的 body 才是内容容器：让它接管剩余高度，内部继续纵向三段布局 */
.table-page__card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
</style>
