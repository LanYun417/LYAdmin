<script setup lang="ts">
/** 操作类型分布玫瑰图。模块职责：取数值最高的前 N 类渲染玫瑰图，中心回显全部操作总数。 */

import { throttle } from 'lodash-es';

import echarts from '@/utils/echarts';
import { CHART_COLORS, getChartPalette } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { NameValue } from '@/types/api';

defineOptions({ name: 'PieChart' });

const props = withDefaults(
  defineProps<{
    /** 名称-数值分布 */
    data: NameValue[];
    /** 只展示数值最高的前 N 项（其余仅在中心总数里体现），默认 5 */
    topN?: number;
  }>(),
  { topN: 5 },
);

/**
 * 全部操作总数：中心数字（含未进入 Top N 的类别）。
 * 占比也统一按这个总数算，否则会出现「标签加起来 100%、中心却写着更大的数」的自相矛盾。
 */
const total = computed(() => props.data.reduce((sum, item) => sum + (item.value || 0), 0));

/** 按数值倒序取前 N 项（玫瑰图只展示这些） */
const topItems = computed(() => [...props.data].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, props.topN));

/** 单项占全部操作的百分比文案 */
function percentOf(value: number): string {
  return total.value > 0 ? `${((value / total.value) * 100).toFixed(1)}%` : '0%';
}

const appStore = useAppStore();
const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const items = topItems.value;
  const hasData = items.length > 0;

  const data = items.map((item, index) => ({
    ...item,
    itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
  }));

  /** tooltip：次数 + 占全部操作的百分比（不走 echarts 的 {d}，它按图内合计算，和中心总数口径不同） */
  function tooltipFormatter(params: { name: string; value: number; color: string }): string {
    const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color};margin-right:6px"></span>`;
    return `${dot}${params.name}：${params.value} 次（${percentOf(params.value)}）`;
  }

  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      formatter: tooltipFormatter,
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
        // 玫瑰图：半径随数值变化（角度均分），比普通饼图更能看出量级差
        roseType: 'radius',
        radius: ['32%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: palette.cardBg, borderWidth: 3, borderRadius: 4 },
        label: {
          show: true,
          color: palette.text,
          fontSize: 12,
          formatter: (params: { name: string; value: number }) => `${params.name} ${percentOf(params.value)}`,
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
          text: hasData ? total.value.toLocaleString() : '0',
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
