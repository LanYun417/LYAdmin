<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import echarts from '@/utils/echarts';
import { getChartPalette, hexToRgba, verticalGradient } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { LoginTrend } from '@/types/api';

defineOptions({ name: 'TrendChart' });

const props = defineProps<{
  /** 登录趋势数据 */
  data: LoginTrend;
}>();

const appStore = useAppStore();
const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const primary = appStore.primaryColor;
  const hasData = props.data.counts.length > 0;

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      axisPointer: { type: 'line', lineStyle: { color: hexToRgba(primary, 0.4) } },
    },
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.data.dates,
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: palette.textSecondary, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: '登录次数',
        type: 'line',
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: false,
        lineStyle: { width: 3, color: primary },
        itemStyle: { color: primary, borderColor: palette.cardBg, borderWidth: 2 },
        emphasis: { focus: 'series' },
        areaStyle: {
          color: verticalGradient(hexToRgba(primary, 0.32), hexToRgba(primary, 0.02)),
        },
        markPoint: hasData
          ? {
              symbol: 'pin',
              symbolSize: 48,
              itemStyle: { color: primary },
              label: { fontSize: 11, color: '#ffffff' },
              data: [{ type: 'max', name: '峰值' }],
            }
          : undefined,
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
// 暗黑模式 / 主题色切换时重绘
watch(() => [appStore.dark, appStore.primaryColor], render);
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
