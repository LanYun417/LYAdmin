<script setup lang="ts">
/**
 * 请求量 / 错误数双序列趋势图。
 * 模块职责：在同一时间轴上展示每日 HTTP 请求总量与其中的错误数（status >= 400）。
 * 布局遵循《19-图表约定》：legend 显式置顶、grid.top 预留、主序列铺面积、次序列用辉光、主题联动、ResizeObserver。
 */
import { throttle } from 'lodash-es';

import echarts from '@/utils/echarts';
import { GRID_AXIS_LABEL_FIT, getChartPalette, hexToRgba, verticalGradient } from '@/utils/chartTheme';
import { useAppStore } from '@/store/modules/app';
import type { RequestTrend } from '@/types/api';

defineOptions({ name: 'RequestTrendChart' });

const props = defineProps<{
  /** 请求趋势数据 */
  data: RequestTrend;
}>();

const appStore = useAppStore();
const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

const PRIMARY = '#5B8FF9';
const ERROR = '#F56C6C';

/** 渲染图表 */
function render(): void {
  if (!chart) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const hasData = props.data.dates.length > 0;
  // 目标整屏约 6 个刻度，点数多时按间隔抽标签，避免拥挤。
  const labelInterval = Math.max(0, Math.ceil(props.data.dates.length / 6) - 1);

  chart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        textStyle: { color: palette.tooltipText },
        axisPointer: { type: 'line', lineStyle: { color: hexToRgba(PRIMARY, 0.4) } },
      },
      legend: {
        top: 8,
        data: ['请求量', '错误数'],
        textStyle: { color: palette.text },
      },
      grid: { left: 8, right: 16, top: 48, bottom: 8, ...GRID_AXIS_LABEL_FIT },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.data.dates,
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisTick: { show: false },
        axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12, interval: labelInterval },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: palette.textSecondary, fontSize: 12 },
        splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
      },
      series: [
        {
          name: '请求量',
          type: 'line',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: false,
          lineStyle: { width: 3, color: PRIMARY },
          itemStyle: { color: PRIMARY, borderColor: palette.cardBg, borderWidth: 2 },
          emphasis: { focus: 'series' },
          areaStyle: {
            color: verticalGradient(hexToRgba(PRIMARY, 0.3), hexToRgba(PRIMARY, 0.02)),
          },
          z: 3,
          data: props.data.requests,
        },
        // 次序列「辉光」：同数据的粗半透明线贴着曲线走，不铺面积，避免与请求量的填充叠加发灰。
        {
          name: '错误数 glow',
          type: 'line',
          smooth: 0.4,
          showSymbol: false,
          silent: true,
          legendHoverLink: false,
          lineStyle: { width: 10, color: hexToRgba(ERROR, 0.18), cap: 'round' },
          tooltip: { show: false },
          z: 1,
          data: props.data.errors,
        },
        {
          name: '错误数',
          type: 'line',
          smooth: 0.4,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: false,
          lineStyle: { width: 2, color: ERROR },
          itemStyle: { color: ERROR, borderColor: palette.cardBg, borderWidth: 2 },
          emphasis: { focus: 'series' },
          z: 2,
          data: props.data.errors,
        },
      ],
      graphic: hasData
        ? []
        : [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: { text: '暂无数据', fill: palette.textSecondary, fontSize: 14 },
            },
          ],
      // 异步首帧为空时会先写入「暂无数据」图层；后续 setOption 默认采用合并模式，
      // 空数组不会移除旧图层，导致曲线出现后提示仍残留。必须显式替换 graphic 组件。
    },
    { replaceMerge: ['graphic'] },
  );
}

const resize = throttle(
  (): void => {
    chart?.resize();
  },
  100,
  { leading: true, trailing: true },
);

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
watch(() => [appStore.dark, appStore.primaryColor], render);
</script>

<template>
  <div ref="chartRef" class="w-full h-75" />
</template>
