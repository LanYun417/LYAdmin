<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BIconFolder, BIconGraphUp, BIconList, BIconPerson } from 'bootstrap-icons-vue';
import {
  getDashboardStatsApi,
  getLoginTrendApi,
  getOperationDistributionApi,
  getRoleUserCountApi,
} from '@/api/dashboard';
import type { DashboardStats, LoginTrend, NameValue, RoleUserCount } from '@/types/api';
import StatCard from './components/StatCard.vue';
import TrendChart from './components/TrendChart.vue';
import PieChart from './components/PieChart.vue';
import BarChart from './components/BarChart.vue';

defineOptions({ name: 'HomePage' });

const loading = ref(false);
const stats = ref<DashboardStats>({
  userTotal: 0,
  roleTotal: 0,
  menuTotal: 0,
  todayLoginCount: 0,
});
const trend = ref<LoginTrend>({ dates: [], counts: [] });
const distribution = ref<NameValue[]>([]);
const roleUserCount = ref<RoleUserCount>({ names: [], counts: [] });

/** 加载全部仪表盘数据 */
async function loadData(): Promise<void> {
  loading.value = true;
  const tasks = await Promise.allSettled([
    getDashboardStatsApi(),
    getLoginTrendApi(7),
    getOperationDistributionApi(),
    getRoleUserCountApi(),
  ]);
  if (tasks[0].status === 'fulfilled') {
    stats.value = tasks[0].value;
  }
  if (tasks[1].status === 'fulfilled') {
    trend.value = tasks[1].value;
  }
  if (tasks[2].status === 'fulfilled') {
    distribution.value = tasks[2].value;
  }
  if (tasks[3].status === 'fulfilled') {
    roleUserCount.value = tasks[3].value;
  }
  loading.value = false;
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div v-loading="loading" class="home-page">
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="6">
        <StatCard title="用户总数" :value="stats.userTotal" :icon="BIconPerson" color="#409eff" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <StatCard title="角色总数" :value="stats.roleTotal" :icon="BIconFolder" color="#67c23a" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <StatCard title="菜单总数" :value="stats.menuTotal" :icon="BIconList" color="#e6a23c" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <StatCard title="今日登录" :value="stats.todayLoginCount" :icon="BIconGraphUp" color="#f56c6c" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-4">
      <el-col :xs="24" :md="16">
        <el-card shadow="never">
          <template #header>近 7 日登录趋势</template>
          <TrendChart :data="trend" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>操作类型分布</template>
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
