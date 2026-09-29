<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from '@/utils/element';
import { BIconArrowClockwise, BIconDownload } from 'bootstrap-icons-vue';
import { exportLoginLogsApi, getLoginLogsApi } from '@/api/log';
import { useTable } from '@/hooks/useTable';
import { formatDate, formatDateTime } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogLogin' });

const exporting = ref(false);
const dateRange = ref<string[]>([]);

const { loading, list, total, query, getList, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getLoginLogsApi({
      page: p.page,
      pageSize: p.pageSize,
      username: p.username || undefined,
      status: p.status,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
    }),
  { username: '', status: undefined as number | undefined },
);

/** 导出登录日志（P2）：按当前筛选条件导出，不带分页参数 */
async function handleExport(): Promise<void> {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportLoginLogsApi({
      username: query.username || undefined,
      status: query.status,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
    });
    downloadBlob(blob, `登录日志_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.csv`);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="log-login-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="账号">
        <el-input v-model="query.username" placeholder="请输入账号" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="结果">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option label="成功" :value="1" />
          <el-option label="失败" :value="0" />
        </el-select>
      </el-form-item>
      <template #advanced>
        <el-form-item label="登录时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[15px] font-semibold text-ink">登录日志</span>
        <div class="flex items-center gap-2">
          <el-button
            v-permission="'log:login:export'"
            type="primary"
            :icon="BIconDownload"
            :loading="exporting"
            @click="handleExport"
          >
            导出
          </el-button>
          <el-button :icon="BIconArrowClockwise" @click="getList">刷新</el-button>
        </div>
      </div>

      <Table v-loading="loading" :data="list">
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="ip" label="IP 地址" width="140" />
        <el-table-column prop="userAgent" label="User-Agent" min-width="220" show-overflow-tooltip />
        <el-table-column label="结果" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column label="登录时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.loginAt) }}</template>
        </el-table-column>
      </Table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>
  </div>
</template>
