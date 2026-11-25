<script setup lang="ts">
/**
 * 首页仪表盘。
 * 模块职责：聚合统计卡片、三类趋势（登录 / 请求与错误 / 活跃用户）、操作类型分布与各角色用户数，
 * 并交给对应图表子组件渲染；顶部时间范围切换统一作用于三类趋势。
 */

import {
  getActiveUserTrendApi,
  getDashboardStatsApi,
  getLoginTrendApi,
  getOperationDistributionApi,
  getRequestTrendApi,
  getRoleUserCountApi,
} from '@/api/dashboard';
import type { DashboardStats, LoginTrend, NameValue, RequestTrend, RoleUserCount } from '@/types/api';
import { useUserStore } from '@/store/modules/user';
import StatCard from './components/StatCard.vue';
import TrendChart from './components/TrendChart.vue';
import RequestTrendChart from './components/RequestTrendChart.vue';
import PieChart from './components/PieChart.vue';
import BarChart from './components/BarChart.vue';

defineOptions({ name: 'HomePage' });

const userStore = useUserStore();

const loading = ref(false);
/** 趋势时间范围（天），三类趋势共用 */
const range = ref<7 | 30>(7);
const stats = ref<DashboardStats>({
  userTotal: 0,
  roleTotal: 0,
  menuTotal: 0,
  todayLoginCount: 0,
  todayRequestCount: 0,
  todayErrorCount: 0,
});
const loginTrend = ref<LoginTrend>({ dates: [], counts: [] });
const requestTrend = ref<RequestTrend>({ dates: [], requests: [], errors: [] });
const activeUserTrend = ref<LoginTrend>({ dates: [], counts: [] });
const distribution = ref<NameValue[]>([]);
const roleUserCount = ref<RoleUserCount>({ names: [], counts: [] });

/** 加载全部仪表盘数据；卡片与分布不随范围变化，趋势三项按当前 range 拉取 */
async function loadData(): Promise<void> {
  loading.value = true;
  const days = range.value;
  const tasks = await Promise.allSettled([
    getDashboardStatsApi(),
    getLoginTrendApi(days),
    getRequestTrendApi(days),
    getActiveUserTrendApi(days),
    getOperationDistributionApi(),
    getRoleUserCountApi(),
  ]);
  if (tasks[0].status === 'fulfilled') {
    stats.value = tasks[0].value;
  }
  if (tasks[1].status === 'fulfilled') {
    loginTrend.value = tasks[1].value;
  }
  if (tasks[2].status === 'fulfilled') {
    requestTrend.value = tasks[2].value;
  }
  if (tasks[3].status === 'fulfilled') {
    activeUserTrend.value = tasks[3].value;
  }
  if (tasks[4].status === 'fulfilled') {
    distribution.value = tasks[4].value;
  }
  if (tasks[5].status === 'fulfilled') {
    roleUserCount.value = tasks[5].value;
  }
  loading.value = false;
}

onMounted(() => {
  void loadData();
});

/** 趋势时间范围变化后重新拉取趋势数据 */
function handleRangeChange(): void {
  void loadData();
}

/** 按时段问候 */
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) {
    return '夜深了';
  }
  if (hour < 9) {
    return '早上好';
  }
  if (hour < 12) {
    return '上午好';
  }
  if (hour < 14) {
    return '中午好';
  }
  if (hour < 18) {
    return '下午好';
  }
  return '晚上好';
});

/** 今日日期（2026年9月23日 星期三） */
const todayText = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());
</script>

<template>
  <div v-loading="loading" class="home-page">
    <header class="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 class="text-xl font-bold text-ink">{{ greeting }}，{{ userStore.nickname }}</h2>
        <p class="mt-1.5 text-[13px] text-muted">今天是 {{ todayText }}，欢迎回来</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[13px] text-muted">趋势范围</span>
        <el-radio-group v-model="range" size="small" @change="handleRangeChange">
          <el-radio-button :value="7">近 7 日</el-radio-button>
          <el-radio-button :value="30">近 30 日</el-radio-button>
        </el-radio-group>
      </div>
    </header>

    <!-- 核心指标：用户 / 角色 / 菜单 / 今日登录 / 今日请求 / 今日错误 -->
    <el-row :gutter="16">
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="用户总数" :value="stats.userTotal" icon="person" color="#409eff" />
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="角色总数" :value="stats.roleTotal" icon="folder" color="#67c23a" />
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="菜单总数" :value="stats.menuTotal" icon="list" color="#e6a23c" />
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="今日登录" :value="stats.todayLoginCount" icon="graph-up" color="#f56c6c" />
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="今日请求" :value="stats.todayRequestCount" icon="arrow-repeat" color="#7262fd" />
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4" class="my-1">
        <StatCard title="今日错误" :value="stats.todayErrorCount" icon="exclamation-triangle" color="#e6a23c" />
      </el-col>
    </el-row>

    <!-- 登录趋势 / 请求与错误趋势 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>近 {{ range }} 日登录趋势</template>
          <TrendChart :data="loginTrend" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>近 {{ range }} 日请求与错误趋势</template>
          <RequestTrendChart :data="requestTrend" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 活跃用户趋势 / 操作类型分布 -->
    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>近 {{ range }} 日活跃用户趋势</template>
          <TrendChart :data="activeUserTrend" name="活跃用户" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <!-- 括注的是「全部操作类型」的数量（图表只画 Top5），未加载完不显示，避免闪一下「共 0 种」 -->
          <template #header>
            <span>操作类型分布{{ distribution.length > 0 ? `（共 ${distribution.length} 种）` : '' }}</span>
          </template>
          <PieChart :data="distribution" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-4">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>各角色用户数</template>
          <BarChart :data="roleUserCount" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
