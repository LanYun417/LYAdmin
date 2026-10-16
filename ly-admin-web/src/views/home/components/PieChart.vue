<script setup lang="ts">
/** 操作类型分布环形图。模块职责：渲染各操作类型占比，中心回显操作总数。 */

import { throttle } from 'lodash-es';

import echarts from '@/utils/echarts';
import { CHART_COLORS, getChartPalette } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { NameValue } from '@/types/api';

defineOptions({ name: 'PieChart' });

const props = defineProps<{
  /** 名称-数值分布 */
  data: NameValue[];
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
  const hasData = props.data.length > 0;
  const total = props.data.reduce((sum, item) => sum + (item.value || 0), 0);

  const data = props.data.map((item, index) => ({
    ...item,
    itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
  }));

  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: palette.textSecondary, fontSize: 12 },
    },
    series: [
      {
        name: '操作类型分布',
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.cardBg, borderWidth: 3, borderRadius: 4 },
        label: {
          show: true,
          color: palette.text,
          fontSize: 12,
          formatter: '{b} {d}%',
        },
        labelLine: { length: 12, length2: 8, lineStyle: { color: palette.axisLine } },
        emphasis: {
          scaleSize: 6,
          itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0, 0, 0, 0.25)' },
          label: { fontSize: 13, fontWeight: 600 },
        },
        data,
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '37%',
        silent: true,
        style: {
          text: hasData ? total.toLocaleString() : '0',
          textAlign: 'center',
          fill: palette.text,
          fontSize: 28,
          fontWeight: 700,
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '49%',
        silent: true,
        style: {
          text: '操作总数',
          textAlign: 'center',
          fill: palette.textSecondary,
          fontSize: 12,
        },
      },
    ],
  });
}

/**
 * 自适应尺寸。
 * 用 lodash-es 的 throttle 限频：窗口拖拽、侧边栏折叠 / 展开等场景下，
 * ResizeObserver 会在短时间内高频触发，直接同步调用 echarts.resize() 会带来大量重复的重排版开销；
 * 限频到 100ms（leading+trailing）既能即时响应首次变化，又避免连续重排。
 */
const resize = throttle(
  (): void => {
    chart?.resize();
  },
  100,
  { leading: true, trailing: true },
);

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
  resize.cancel();
  chart?.dispose();
  chart = null;
});

watch(() => props.data, render, { deep: true });
// 暗黑模式 / 主题色切换时重绘
watch(() => [appStore.dark, appStore.primaryColor], render);
</script>

<template>
  <div ref="chartRef" class="w-full h-75" />
</template>
