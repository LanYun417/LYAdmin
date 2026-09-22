<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { NameValue } from '@/types/api';

defineOptions({ name: 'PieChart' });

const props = defineProps<{
  /** 名称-数值分布 */
  data: NameValue[];
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

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

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    render();
    window.addEventListener('resize', resize);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
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
