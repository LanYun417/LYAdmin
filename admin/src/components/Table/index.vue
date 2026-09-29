<script setup lang="ts">
import { computed, useAttrs } from 'vue';

/**
 * el-table 二次封装（P2 复用）。
 *
 * 作用：
 * - 默认给表格加 `max-height`（560px），表头固定、内容区在可视区内滚动，避免超长列表把页面整体撑高；
 * - 调用方显式传 `height` / `max-height` 时优先，不重复设置（如代码生成「列信息」表用固定 height）；
 * - 透传所有属性 / 事件 / 默认插槽到内部 el-table（v-loading、:data、row-key、border 等原样转发）。
 *
 * 用法：与 el-table 完全一致，仅把标签换成 <Table>；如需更小/更大高度，传 :max-height 或 :height。
 */
// 有意命名为 Table（el-table 二次封装）；非原生 <table> 误用，故关闭保留名检查
// eslint-disable-next-line vue/no-reserved-component-names
defineOptions({ name: 'Table', inheritAttrs: false });

const props = defineProps<{
  /** 默认最大高度（px 或 CSS 长度）。调用方显式传 height / max-height 时优先。 */
  maxHeight?: number | string;
}>();

const attrs = useAttrs();

/** 默认最大高度：表头固定 + 内容区滚动。 */
const DEFAULT_MAX_HEIGHT = 560;

const resolvedMaxHeight = computed<number | string | undefined>(() => {
  // 调用方已显式指定高度 / 最大高度，尊重其设置，避免与封装默认值冲突
  if (attrs.height !== undefined || attrs.maxHeight !== undefined) {
    return undefined;
  }
  return props.maxHeight ?? DEFAULT_MAX_HEIGHT;
});
</script>

<template>
  <el-table v-bind="attrs" :max-height="resolvedMaxHeight">
    <slot />
  </el-table>
</template>
