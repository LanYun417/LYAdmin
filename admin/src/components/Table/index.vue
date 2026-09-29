<script setup lang="ts">
import { useAttrs } from 'vue';

/**
 * el-table 二次封装。
 *
 * 作用：透传所有属性 / 事件 / 默认插槽到内部 el-table（v-loading、:data、row-key、border 等原样转发），
 * 统一全站表格的书写方式，便于后续集中调整表格的默认行为。
 *
 * 用法：与 el-table 完全一致，仅把标签换成 <Table>；高度约束由调用方传 :height / :max-height。
 */
// 有意命名为 Table（el-table 二次封装）；非原生 <table> 误用，故关闭保留名检查
// eslint-disable-next-line vue/no-reserved-component-names
defineOptions({ name: 'Table', inheritAttrs: false });

const attrs = useAttrs();
</script>

<template>
  <el-table v-bind="attrs">
    <slot />
  </el-table>
</template>
