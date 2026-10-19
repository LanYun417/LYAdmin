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

/* ------------------------------ 趋势图 ------------------------------ */

const chartRef = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | null = null;

/** 渲染 CPU / 内存双折线 */
function renderChart(): void {
  if (!chart || !metrics.value) {
    return;
  }
  const palette = getChartPalette(appStore.dark);
  const primary = appStore.primaryColor;
  const points = metrics.value.history.slice(-CHART_POINTS);
  /**
   * X 轴标签间隔：目标"整屏约 6 个"。
   * 采样间隔 3s、默认展示 60 点，若不控数量 ECharts 会自动抽成每 15s 一个（12 个），
   * 又密又难读；这里按点数反推 interval，让刻度稳定落在整分钟附近。
   */
  const labelInterval = Math.max(0, Math.ceil(points.length / 6) - 1);

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
      data: points.map((point) => new Date(point.at).toLocaleTimeString('zh-CN', { hour12: false })),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: palette.textSecondary, fontSize: 12, margin: 12, interval: labelInterval },
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
        data: points.map((point) => point.cpu),
        lineStyle: { width: 3, color: primary },
        itemStyle: { color: primary, borderColor: palette.cardBg, borderWidth: 2 },
        areaStyle: { color: verticalGradient(hexToRgba(primary, 0.3), hexToRgba(primary, 0.02)) },
      },
      {
        name: t('monitor.memoryUsage'),
        // 内存曲线基本是一条水平线，**不铺面积**：两条半透明填充叠在一起会把下方糊成一整块，
        // 既看不出信息、也让图表显得脏（原先就是这个问题）
        type: 'line',
        smooth: true,
        showSymbol: false,
        emphasis: { focus: 'series' },
        data: points.map((point) => point.memory),
        lineStyle: { width: 2, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b', borderColor: palette.cardBg, borderWidth: 2 },
      },
    ],
  });
}

/** 容器尺寸变化 → 重绘（throttle 避免连续重排） */
const resize = throttle((): void => void chart?.resize(), 100, { leading: true, trailing: true });
useResizeObserver(chartRef, resize);

onMounted(async () => {
  await fetchMetrics();
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    renderChart();
  }
});

onBeforeUnmount(() => {
  resize.cancel();
  chart?.dispose();
  chart = null;
});

/** 数据或主题变化 → 重绘 */
watch(metrics, renderChart, { deep: true });
watch(() => [appStore.dark, appStore.primaryColor], renderChart);

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

    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :lg="16">
        <el-card shadow="never">
          <div class="mb-2 text-[15px] font-semibold text-ink">{{ t('monitor.trend') }}</div>
          <div ref="chartRef" class="h-72 w-full" />
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
