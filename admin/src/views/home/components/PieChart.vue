<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import echarts from '@/utils/echarts';
import type { NameValue } from '@/types/api';

defineOptions({ name: 'PieChart' });

const props = defineProps<{
  /** 名称-数值分布 */
  data: NameValue[];
}>();

const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#909399' } },
    series: [
      {
        name: '操作类型分布',
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { color: '#909399' },
        data: props.data,
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
