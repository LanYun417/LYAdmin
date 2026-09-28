<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import echarts from '@/utils/echarts';
import { getChartPalette, hexToRgba, verticalGradient } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { RoleUserCount } from '@/types/api';

defineOptions({ name: 'BarChart' });

const props = defineProps<{
  /** 各角色用户数 */
  data: RoleUserCount;
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
  const counts = props.data.counts;
  const max = counts.length ? Math.max(...counts) : 0;

  // 普通柱用主题色渐变，最大值柱用更饱和的高亮渐变
  const data = counts.map((value) => ({
    value,
    itemStyle: {
      color:
        value === max && max > 0
          ? verticalGradient(primary, hexToRgba(primary, 0.55))
          : verticalGradient(hexToRgba(primary, 0.85), hexToRgba(primary, 0.25)),
    },
  }));

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      axisPointer: { type: 'shadow', shadowStyle: { color: hexToRgba(primary, 0.06) } },
    },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.data.names,
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12, interval: 0, margin: 12 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: palette.textSecondary, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: '用户数',
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', color: palette.textSecondary, fontSize: 12 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: hexToRgba(primary, 0.35) } },
        data,
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
  <div ref="chartRef" class="w-full h-[300px]" />
</template>
