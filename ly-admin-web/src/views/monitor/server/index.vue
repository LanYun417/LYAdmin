<script setup lang="ts">
/**
 * 系统监控页。
 * 模块职责：展示后端采样的系统资源（CPU / 内存 / 磁盘 / 进程 / 负载）与最近几分钟的趋势曲线。
 *
 * 三个刻意的做法：
 * 1. **口径必须显式标注**：响应里的 `scope` 表明数字读的是容器 cgroup 限制还是宿主机资源，
 *    页面右上角用标签点出来——否则容器里会显示"16G 用了 3G"，而实际 512M 就 OOM；
 * 2. **自动刷新但会自己停**：默认每 5s 拉一次（后端本就是 3s 采样，前端更快没意义），
 *    页面切到后台（`document.hidden`）时暂停，避免在用户看不见的标签页里持续打请求；
 * 3. **趋势图数据来自后端环形缓冲**：刷新后曲线不会从零重画，能立刻看到最近几分钟的历史。
 */
import { throttle } from 'lodash-es';
import { useDocumentVisibility } from '@vueuse/core';
import echarts from '@/utils/echarts';
import { getChartPalette, hexToRgba, GRID_AXIS_LABEL_FIT, verticalGradient } from '@/utils/chartTheme';
import { ElMessage } from '@/utils/element';
import { getServerMetricsApi } from '@/api/monitor';
import { useAppStore } from '@/store/modules/app';
import { useI18n } from 'vue-i18n';
import type { ServerMetrics } from '@/types/api';

defineOptions({ name: 'MonitorServer' });

const appStore = useAppStore();
const { t } = useI18n();

/** 自动刷新间隔（毫秒）。后端 3s 采样一次，前端 5s 拉一次即可 */
const REFRESH_INTERVAL_MS = 5000;
/** 曲线展示的采样点数（后端最多给 120 点） */
const CHART_POINTS = 60;

const loading = ref(false);
const metrics = ref<ServerMetrics | null>(null);
/** 是否自动刷新 */
const autoRefresh = ref(true);
const visibility = useDocumentVisibility();

/** 字节格式化（按 1024 进制，保留 1 位小数） */
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * 字节/秒 → 人类可读速率。
 * @param compact 紧凑模式（轴刻度用）：不带 "/s" 后缀，省横向空间
 */
/**
 * 字节/秒 → 数值与单位分开返回。
 * 拆开的用途：主指标需要"大号数值 + 小号单位"（`formatRate` 只能给一整串），
 * 否则 `63.0 KB/s` 全用大字号，读起来很笨重。
 */
function rateParts(bytesPerSecond: number | null | undefined): { value: string; unit: string } {
  if (bytesPerSecond === null || bytesPerSecond === undefined || !Number.isFinite(bytesPerSecond)) {
    return { value: '-', unit: '' };
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytesPerSecond;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  // 小于 1KB 时不带小数（"37 B/s" 比 "37.0 B/s" 干净）
  return { value: unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1), unit: `${units[unitIndex]}/s` };
}

/**
 * 字节/秒 → 人类可读速率（数值 + 单位连写，用于表格、提示框这类紧凑位置）。
 * @param compact 紧凑模式（轴刻度用）：不带 "/s" 后缀，省横向空间
 */
function formatRate(bytesPerSecond: number | null | undefined, compact = false): string {
  const { value, unit } = rateParts(bytesPerSecond);
  if (unit === '') {
    return value;
  }
  const text = `${value} ${compact ? unit.replace('/s', '') : unit}`;
  return text;
}

/** 秒 → 人类可读时长 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days} 天 ${hours} 小时`;
  }
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分`;
  }
  return `${minutes} 分 ${Math.floor(seconds % 60)} 秒`;
}

/** 使用率 → 进度条颜色（<60 正常 / <85 警告 / 其余危险） */
function usageColor(usage: number | null): string {
  if (usage === null) {
    return 'var(--el-color-info)';
  }
  if (usage >= 85) {
    return 'var(--el-color-danger)';
  }
  if (usage >= 60) {
    return 'var(--el-color-warning)';
  }
  return 'var(--el-color-success)';
}

/** 拉取指标 */
async function fetchMetrics(): Promise<void> {
  if (loading.value) {
    return;
  }
  loading.value = true;
  try {
    metrics.value = await getServerMetricsApi();
  } catch {
    // 失败提示由请求层统一处理；这里保持上一次数据，不清空页面
  } finally {
    loading.value = false;
  }
}

/**
 * 网络错误 / 丢包摘要。
 * 这两项平时都是 0，一旦非 0 就是真问题（丢包常见于带宽打满或网卡队列溢出），
 * 所以非 0 时标红，而不是和"累计流量"一样用灰字平铺。
 */
/**
 * 网络错误 / 丢包摘要。
 * 这两项平时都是 0，一旦非 0 就是真问题（丢包常见于带宽打满或网卡队列溢出），
 * 所以非 0 时标红。文案自带字段名（"错误 0 · 丢包 0"），不让读者猜 `0 / 0` 谁是谁。
 */
const netErrorSummary = computed(() => {
  const network = metrics.value?.network;
  if (!network?.supported) {
    return { text: '-', danger: false };
  }
  const errors = network.rxErrors + network.txErrors;
  const dropped = network.rxDropped + network.txDropped;
  return {
    text: `${t('monitor.netErrorShort')} ${errors} · ${t('monitor.netDroppedShort')} ${dropped}`,
    danger: errors + dropped > 0,
  };
});

/**
 * 网卡明细（按累计流量倒序）。
 * 排序原因：未接线的网卡累计为 0，按接口原顺序会排在最前，看起来像"主力网卡没数据"。
 */
const netInterfaces = computed(() =>
  [...(metrics.value?.network.interfaces ?? [])].sort(
    (left, right) => right.rxTotal + right.txTotal - (left.rxTotal + left.txTotal),
  ),
);

/**
 * 上行统一用这个颜色（图表曲线与卡片上的小圆点共用），
 * 同一份色值出现两处就容易漂移，抽成常量。
 */
const NET_UP_COLOR = '#10b981';

/**
 * 上下行的展示单元：数值与单位拆开（大号数值 + 小号单位），
 * 色点与图表图例颜色一一对应，读图时不用再对"哪个颜色是哪条线"。
 */
const rateCards = computed(() => {
  const network = metrics.value?.network;
  const down = rateParts(network?.rxRate);
  const up = rateParts(network?.txRate);
  return [
    { key: 'rx', label: t('monitor.netRx'), value: down.value, unit: down.unit, color: appStore.primaryColor },
    { key: 'tx', label: t('monitor.netTx'), value: up.value, unit: up.unit, color: NET_UP_COLOR },
  ];
});

/* ------------------------------ 图表 ------------------------------ */

/**
 * 统一创建图表实例。
 * 两个图表（资源趋势 / 网络吞吐）的初始化、尺寸自适应、销毁完全一样，抽成一个工厂，
 * 避免把 `echarts.init / ResizeObserver / dispose` 这套样板写两遍（漏一处就是内存泄漏）。
 *
 * ⚠️ **必须懒初始化**：图表容器可能带 `v-if`（如网络图只在平台支持时才渲染），
 * 挂载那一刻容器还不存在。只在 `onMounted` 里 init 会导致实例永远不创建、面板一直空白
 * （真实踩过：网络吞吐面板全白，而没加 v-if 的资源趋势正常）。
 * 所以每次绘制前都 `ensure()` 一次，等容器出现后再建实例。
 *
 * ⚠️ 配合要求：触发绘制的 watch 必须 `flush: 'post'`。
 * 默认 `'pre'` 在**组件重渲染之前**执行，那时 `v-if` 的容器还没插入 DOM，
 * `ensure()` 依然拿不到元素——只加懒初始化而忘了这个，仍会间歇性空白。
 *
 * @param target 图表容器
 * @param draw 绘制回调，拿到实例后调 setOption
 * @returns 重新绘制的函数（数据/主题变化时调用）
 */
function setupChart(
  target: Ref<HTMLDivElement | undefined>,
  draw: (chart: ReturnType<typeof echarts.init>) => void,
): () => void {
  let chart: ReturnType<typeof echarts.init> | null = null;

  /** 容器就绪后才创建实例；已创建则直接返回 */
  const ensure = (): ReturnType<typeof echarts.init> | null => {
    if (!chart && target.value) {
      chart = echarts.init(target.value);
    }
    return chart;
  };

  // 限频 100ms：窗口拖拽、侧边栏折叠会让 ResizeObserver 高频触发
  const resize = throttle((): void => void chart?.resize(), 100, { leading: true, trailing: true });
  useResizeObserver(target, resize);

  onMounted(() => {
    const instance = ensure();
    if (instance) {
      draw(instance);
    }
  });

  onBeforeUnmount(() => {
    resize.cancel();
    chart?.dispose();
    chart = null;
  });

  return (): void => {
    const instance = ensure();
    if (instance) {
      draw(instance);
    }
  };
}

const cpuChartRef = ref<HTMLDivElement>();
const netChartRef = ref<HTMLDivElement>();

/** X 轴时间刻度：与图表数据点一一对应 */
function timeLabels(): string[] {
  const points = metrics.value?.history.slice(-CHART_POINTS) ?? [];
  return points.map((point) => new Date(point.at).toLocaleTimeString('zh-CN', { hour12: false }));
}

/**
 * X 轴标签间隔：目标"整屏约 6 个"。
 * 采样间隔 3s、默认展示 60 点，若不控数量 ECharts 会自动抽成每 15s 一个（12 个），
 * 又密又难读；这里按点数反推 interval，让刻度稳定落在整分钟附近。
 */
function labelInterval(total: number): number {
  return Math.max(0, Math.ceil(total / 6) - 1);
}

/** 渲染 CPU / 内存双折线（单位 %） */
function drawResourceTrend(chart: ReturnType<typeof echarts.init>): void {
  if (!metrics.value) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const primary = appStore.primaryColor;
  const points = metrics.value.history.slice(-CHART_POINTS);

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      axisPointer: { type: 'line', lineStyle: { color: hexToRgba(primary, 0.4) } },
      valueFormatter: (value: unknown) => (value === null ? t('monitor.sampling') : `${value}%`),
    },
    /**
     * 图例**必须显式给 top**：不给位置时 ECharts 会把它排到绘图区底边内部
     * （实测 y≈261，而绘图区是 40~264），结果图例压在曲线与面积上、还和 X 轴标签挤在一起。
     */
    legend: {
      top: 8,
      data: [t('monitor.cpuUsage'), t('monitor.memoryUsage')],
      textStyle: { color: palette.text },
    },
    // 与首页 TrendChart 同一套：只给很小的 padding，留白交给 outerBounds 按轴标签实测宽度自动让位
    grid: { left: 8, right: 16, top: 48, bottom: 8, ...GRID_AXIS_LABEL_FIT },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeLabels(),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12, interval: labelInterval(points.length) },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: palette.textSecondary, fontSize: 12, formatter: '{value}%' },
      splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: t('monitor.cpuUsage'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        emphasis: { focus: 'series' },
        // z 控制叠放顺序：主序列（强渐变）盖在次序列（弱渐变）之上，避免两色混成脏色
        z: 3,
        data: points.map((point) => point.cpu),
        lineStyle: { width: 3, color: primary },
        itemStyle: { color: primary, borderColor: palette.cardBg, borderWidth: 2 },
        areaStyle: { color: verticalGradient(hexToRgba(primary, 0.3), hexToRgba(primary, 0.02)) },
      },
      {
        // 次序列的"阴影"用**辉光层**而不是面积：同数据、更粗、低透明度的线，贴着曲线走。
        // 为什么不用 areaStyle：面积的渐变锚点是**整条序列的包围盒**（最高点）而不是曲线本身，
        // 色块会浮在曲线上方；而两条都铺满面积又会叠成一片灰（两种都踩过）。
        // 辉光层是独立序列，必须 `tooltip.show: false` + `silent`，否则提示框会多出一行。
        name: t('monitor.memoryUsage') + ' glow',
        type: 'line',
        smooth: true,
        showSymbol: false,
        silent: true,
        legendHoverLink: false,
        z: 1,
        data: points.map((point) => point.memory),
        lineStyle: { width: 10, color: hexToRgba('#f59e0b', 0.18), cap: 'round' },
        tooltip: { show: false },
      },
      {
        name: t('monitor.memoryUsage'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        emphasis: { focus: 'series' },
        z: 2,
        data: points.map((point) => point.memory),
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b', borderColor: palette.cardBg, borderWidth: 2 },
      },
    ],
  });
}

/**
 * 渲染网络吞吐双折线（单位 B/s，故必须与百分比分开一张图）。
 * 纵轴不给固定 max：网络速率量级变化极大（几十 B/s 到几十 MB/s），
 * 自动量程比写死上限更容易看出"此刻是否有突发流量"。
 */
function drawNetworkTrend(chart: ReturnType<typeof echarts.init>): void {
  const network = metrics.value?.network;
  if (!network?.supported) {
    // 平台不支持时清空图表（模板里会换成原因提示，不留一张空图误导人）
    chart.clear();
    return;
  }

  const palette = getChartPalette(appStore.dark);
  const points = metrics.value?.history.slice(-CHART_POINTS) ?? [];
  const rxColor = appStore.primaryColor;
  const txColor = NET_UP_COLOR;

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText },
      axisPointer: { type: 'line', lineStyle: { color: hexToRgba(rxColor, 0.4) } },
      valueFormatter: (value: unknown) => (value === null ? t('monitor.sampling') : formatRate(value as number)),
    },
    legend: {
      top: 8,
      data: [t('monitor.netRx'), t('monitor.netTx')],
      textStyle: { color: palette.text },
    },
    grid: { left: 8, right: 16, top: 48, bottom: 8, ...GRID_AXIS_LABEL_FIT },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeLabels(),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12, interval: labelInterval(points.length) },
    },
    yAxis: {
      type: 'value',
      min: 0,
      // 速率量级不定、自动量程，刻度数量收一下（默认会切出 8 条网格线，小卡片里太密）
      splitNumber: 4,
      axisLabel: {
        color: palette.textSecondary,
        fontSize: 12,
        // 轴刻度用紧凑单位（如 1.2M），否则会出现 "1258291" 这种读不出来的刻度
        formatter: (value: number) => formatRate(value, true),
      },
      splitLine: { lineStyle: { color: palette.splitLine, type: 'dashed' } },
    },
    series: [
      {
        name: t('monitor.netRx'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        emphasis: { focus: 'series' },
        z: 3,
        data: points.map((point) => point.rxRate),
        lineStyle: { width: 3, color: rxColor },
        itemStyle: { color: rxColor, borderColor: palette.cardBg, borderWidth: 2 },
        areaStyle: { color: verticalGradient(hexToRgba(rxColor, 0.3), hexToRgba(rxColor, 0.02)) },
      },
      {
        // 与资源趋势一致：次序列用辉光层（同数据粗线）而不是面积
        name: t('monitor.netTx') + ' glow',
        type: 'line',
        smooth: true,
        showSymbol: false,
        silent: true,
        legendHoverLink: false,
        z: 1,
        data: points.map((point) => point.txRate),
        lineStyle: { width: 10, color: hexToRgba(txColor, 0.18), cap: 'round' },
        tooltip: { show: false },
      },
      {
        name: t('monitor.netTx'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        emphasis: { focus: 'series' },
        z: 2,
        data: points.map((point) => point.txRate),
        lineStyle: { width: 2, color: txColor },
        itemStyle: { color: txColor, borderColor: palette.cardBg, borderWidth: 2 },
      },
    ],
  });
}

const drawResource = setupChart(cpuChartRef, drawResourceTrend);
const drawNetwork = setupChart(netChartRef, drawNetworkTrend);

onMounted(async () => {
  await fetchMetrics();
  // 等 DOM 更新（网络图的容器带 v-if，数据到了才渲染出来），再绘制
  await nextTick();
  drawResource();
  drawNetwork();
});

/**
 * 数据或主题变化时重绘两张图。
 * `flush: 'post'` 不是可选项：默认 `'pre'` 在组件重渲染**之前**执行，
 * 那时 `v-if` 的图表容器还没插入 DOM，懒初始化拿不到元素 → 面板空白。
 */
watch(
  metrics,
  () => {
    drawResource();
    drawNetwork();
  },
  { deep: true, flush: 'post' },
);
watch(
  [() => appStore.dark, () => appStore.primaryColor],
  () => {
    drawResource();
    drawNetwork();
  },
  { flush: 'post' },
);

/* ------------------------------ 自动刷新 ------------------------------ */

let timer: ReturnType<typeof setInterval> | null = null;

/** 按「是否自动刷新 + 页面是否可见」决定定时器的启停 */
function syncTimer(): void {
  const shouldRun = autoRefresh.value && visibility.value === 'visible';
  if (shouldRun && timer === null) {
    timer = setInterval(() => void fetchMetrics(), REFRESH_INTERVAL_MS);
    return;
  }
  if (!shouldRun && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

watch([autoRefresh, visibility], syncTimer, { immediate: true });
onBeforeUnmount(() => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
});

/** 手动刷新 */
async function handleRefresh(): Promise<void> {
  await fetchMetrics();
  ElMessage.success(t('common.success'));
}
</script>

<template>
  <div class="monitor-server-page">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-y-2">
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-semibold text-ink">{{ t('monitor.title') }}</span>
          <!-- 口径标签：容器里读的是 cgroup 限制，与"宿主机资源"是两件事 -->
          <el-tag v-if="metrics" :type="metrics.scope === 'container' ? 'warning' : 'info'" size="small">
            {{ metrics.scope === 'container' ? t('monitor.scopeContainer') : t('monitor.scopeHost') }}
          </el-tag>
          <span v-if="metrics" class="text-xs text-faint">
            {{ t('monitor.sampledAt') }}
            {{ new Date(metrics.sampledAt).toLocaleTimeString('zh-CN', { hour12: false }) }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <el-checkbox v-model="autoRefresh">
            {{ t('monitor.autoRefresh') }}（{{ REFRESH_INTERVAL_MS / 1000 }}s）
          </el-checkbox>
          <el-button :loading="loading" @click="handleRefresh">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" class="mt-4">
      <el-col v-for="card in ['cpu', 'memory', 'disk', 'process']" :key="card" :xs="24" :sm="12" :lg="6">
        <el-card shadow="never" class="h-full">
          <template v-if="card === 'cpu'">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">{{ t('monitor.cpuUsage') }}</span>
              <i class="bi bi-cpu text-muted" />
            </div>
            <div class="mt-2 flex items-end gap-2">
              <span class="text-2xl font-semibold" :style="{ color: usageColor(metrics?.cpu.usage ?? null) }">
                {{
                  metrics?.cpu.usage === null || metrics?.cpu.usage === undefined
                    ? t('monitor.sampling')
                    : `${metrics.cpu.usage}%`
                }}
              </span>
              <span class="text-xs text-faint mb-1">{{ metrics?.cpu.cores ?? 0 }} {{ t('monitor.cores') }}</span>
            </div>
            <el-progress
              class="mt-2"
              :percentage="metrics?.cpu.usage ?? 0"
              :stroke-width="8"
              :show-text="false"
              :color="usageColor(metrics?.cpu.usage ?? null)"
            />
            <p v-if="metrics?.cpu.quotaCores" class="mt-2 text-xs text-faint">
              {{ t('monitor.quotaCores') }}：{{ metrics.cpu.quotaCores }}
            </p>
            <!-- 每核使用率：核多时用条形小图，一眼看出是否有单核打满 -->
            <div v-if="metrics && metrics.cpu.perCore.length > 1" class="mt-2">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="(core, index) in metrics.cpu.perCore"
                  :key="index"
                  class="inline-block h-3 w-3 rounded-sm"
                  :style="{ backgroundColor: core === null ? 'var(--el-fill-color)' : usageColor(core) }"
                  :title="`CPU${index}: ${core === null ? t('monitor.sampling') : `${core}%`}`"
                />
              </div>
            </div>
          </template>

          <template v-else-if="card === 'memory'">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">{{ t('monitor.memoryUsage') }}</span>
              <i class="bi bi-memory text-muted" />
            </div>
            <div class="mt-2 flex items-end gap-2">
              <span class="text-2xl font-semibold" :style="{ color: usageColor(metrics?.memory.usage ?? null) }">
                {{
                  metrics?.memory.usage === null || metrics?.memory.usage === undefined
                    ? '-'
                    : `${metrics.memory.usage}%`
                }}
              </span>
            </div>
            <el-progress
              class="mt-2"
              :percentage="metrics?.memory.usage ?? 0"
              :stroke-width="8"
              :show-text="false"
              :color="usageColor(metrics?.memory.usage ?? null)"
            />
            <p class="mt-2 text-xs text-faint">
              {{ formatBytes(metrics?.memory.used) }} / {{ formatBytes(metrics?.memory.total) }}
            </p>
          </template>

          <template v-else-if="card === 'disk'">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">{{ t('monitor.diskUsage') }}</span>
              <i class="bi bi-hdd text-muted" />
            </div>
            <div class="mt-2 flex items-end gap-2">
              <span class="text-2xl font-semibold" :style="{ color: usageColor(metrics?.disk.usage ?? null) }">
                {{ metrics?.disk.usage === null || metrics?.disk.usage === undefined ? '-' : `${metrics.disk.usage}%` }}
              </span>
            </div>
            <el-progress
              class="mt-2"
              :percentage="metrics?.disk.usage ?? 0"
              :stroke-width="8"
              :show-text="false"
              :color="usageColor(metrics?.disk.usage ?? null)"
            />
            <p class="mt-2 text-xs text-faint" :title="metrics?.disk.path">
              {{ formatBytes(metrics?.disk.used) }} / {{ formatBytes(metrics?.disk.total) }}
            </p>
          </template>

          <template v-else>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">{{ t('monitor.processMemory') }}</span>
              <i class="bi bi-box text-muted" />
            </div>
            <div class="mt-2 flex items-end gap-2">
              <span class="text-2xl font-semibold text-ink">{{ formatBytes(metrics?.process.rss) }}</span>
            </div>
            <p class="mt-4 text-xs text-faint">
              {{ t('monitor.heapUsed') }}：{{ formatBytes(metrics?.process.heapUsed) }} /
              {{ formatBytes(metrics?.process.heapTotal) }}
            </p>
            <p class="mt-1 text-xs text-faint">
              {{ t('monitor.processUptime') }}：{{ metrics ? formatUptime(metrics.process.uptime) : '-' }}
            </p>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <!-- 网络活动卡片 + 网络吞吐趋势：单位是 B/s，与"使用率 %"不同，故单独一张图 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :lg="8">
        <el-card shadow="never" class="h-full">
          <!-- 纵向布局撑满卡片高度：右侧图表把行高拉起来，内容不足时要主动填满，
               否则卡片下方会留一大片空白（原先就是这样，看起来像没做完） -->
          <div class="flex h-full flex-col">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted">{{ t('monitor.network') }}</span>
              <!-- 口径与采样节奏收进提示，不再用两行灰字占版面 -->
              <el-tooltip placement="top" effect="dark">
                <template #content>
                  <div class="max-w-72 leading-relaxed">
                    {{ t('monitor.netHint') }}
                    <template v-if="metrics?.network.source === 'powershell'">
                      <br />
                      {{
                        t('monitor.netCadence', { s: Math.round((metrics?.network.samplingIntervalMs ?? 0) / 1000) })
                      }}
                    </template>
                  </div>
                </template>
                <el-icon class="cursor-help text-muted" role="button" tabindex="0" :aria-label="t('monitor.netHint')">
                  <i class="bi bi-info-circle" />
                </el-icon>
              </el-tooltip>
            </div>

            <template v-if="metrics?.network.supported">
              <!-- 主指标：数值大、单位小；左侧小圆点与图表图例颜色对应 -->
              <div class="mt-4 grid grid-cols-2 gap-4">
                <div v-for="item in rateCards" :key="item.key">
                  <p class="flex items-center gap-1.5 text-xs text-faint">
                    <span
                      class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      :style="{ backgroundColor: item.color }"
                    />
                    {{ item.label }}
                  </p>
                  <p class="mt-1 flex items-baseline gap-1">
                    <span class="text-2xl font-semibold leading-none text-ink">{{ item.value }}</span>
                    <span class="text-xs text-muted">{{ item.unit }}</span>
                  </p>
                </div>
              </div>

              <!-- 累计流量 / 异常：两行对齐的键值 -->
              <div class="mt-4 border-t border-line-light pt-3 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-faint">{{ t('monitor.netTotal') }}</span>
                  <span class="tabular-nums text-ink-regular">
                    ↓ {{ formatBytes(metrics?.network.rxTotal) }} · ↑ {{ formatBytes(metrics?.network.txTotal) }}
                  </span>
                </div>
                <div class="mt-1.5 flex items-center justify-between">
                  <span class="text-faint">{{ t('monitor.netAbnormal') }}</span>
                  <span
                    class="tabular-nums"
                    :class="netErrorSummary.danger ? 'font-medium text-[var(--el-color-danger)]' : 'text-ink-regular'"
                  >
                    {{ netErrorSummary.text }}
                  </span>
                </div>
              </div>

              <!-- 网卡明细：贴底（mt-auto），数字右对齐；用标签做会参差不齐 -->
              <div v-if="netInterfaces.length" class="mt-auto border-t border-line-light pt-3">
                <p class="mb-1.5 text-xs text-faint">{{ t('monitor.netInterfaces') }}</p>
                <div
                  v-for="iface in netInterfaces"
                  :key="iface.name"
                  class="flex items-center justify-between gap-2 py-0.5 text-xs"
                  :title="`${iface.name}：↓ ${formatBytes(iface.rxTotal)} / ↑ ${formatBytes(iface.txTotal)}`"
                >
                  <span class="truncate text-ink-regular">{{ iface.name }}</span>
                  <span class="shrink-0 tabular-nums text-muted">
                    ↓ {{ formatRate(iface.rxRate) }} · ↑ {{ formatRate(iface.txRate) }}
                  </span>
                </div>
              </div>
            </template>

            <el-alert
              v-else
              class="mt-3"
              type="info"
              :closable="false"
              show-icon
              :title="t('monitor.netUnsupported')"
              :description="metrics?.network.reason ?? ''"
            />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="16">
        <el-card shadow="never" class="h-full">
          <div class="mb-2 text-[15px] font-semibold text-ink">{{ t('monitor.netTrend') }}</div>
          <div v-if="metrics?.network.supported" ref="netChartRef" class="h-72 w-full" />
          <el-alert
            v-else
            class="mt-4"
            type="info"
            :closable="false"
            show-icon
            :title="t('monitor.netUnsupported')"
            :description="metrics?.network.reason ?? ''"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :lg="16">
        <el-card shadow="never">
          <div class="mb-2 text-[15px] font-semibold text-ink">{{ t('monitor.trend') }}</div>
          <div ref="cpuChartRef" class="h-72 w-full" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="8">
        <el-card shadow="never" class="h-full">
          <div class="mb-3 text-[15px] font-semibold text-ink">{{ t('monitor.systemInfo') }}</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item :label="t('monitor.hostname')">{{
              metrics?.system.hostname ?? '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.os')">
              {{ metrics ? `${metrics.system.platform} ${metrics.system.release} (${metrics.system.arch})` : '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('monitor.nodeVersion')">{{
              metrics?.system.nodeVersion ?? '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.appVersion')">{{
              metrics?.system.appVersion ?? '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.cpuModel')">{{ metrics?.cpu.model || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="t('monitor.loadAvg')">
              {{ metrics?.load ? metrics.load.join(' / ') : t('monitor.loadUnsupported') }}
            </el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="metrics?.warmingUp"
            class="mt-3"
            type="info"
            :closable="false"
            :title="t('monitor.warmingUp')"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
