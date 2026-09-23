<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import * as echarts from 'echarts';
import type { RoleUserCount } from '@/types/api';

defineOptions({ name: 'BarChart' });

const props = defineProps<{
  /** 各角色用户数 */
  data: RoleUserCount;
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: props.data.names,
      axisLabel: { color: '#909399' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#909399' },
    },
    series: [
      {
        name: '用户数',
        type: 'bar',
        barMaxWidth: 40,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: props.data.counts,
      },
    ],
  });
}

/** 自适应尺寸 */
function resize(): void {
  chart?.resize();
}

/**
 * 监听图表容器尺寸变化（而非只监听 window resize）。
 * 这样窗口缩放、侧边栏折叠 / 展开、移动端断点切换导致容器变宽变窄时，图表都能重新适配。
 */
useResizeObserver(chartRef, resize);

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    render();
  }
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});

watch(() => props.data, render, { deep: true });
</script>

<template>
  <div ref="chartRef" class="chart" />
</template>

<style scoped>
.chart {
  width: 100%;
  height: 300px;
}
</style>
