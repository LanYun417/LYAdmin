<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from '@/utils/element';
import { BIconArrowClockwise, BIconDownload } from 'bootstrap-icons-vue';
import { exportOperationLogsApi, getOperationLogsApi } from '@/api/log';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import type { OperationLog } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogOperation' });

const loading = ref(false);
const exporting = ref(false);
const list = ref<OperationLog[]>([]);
const total = ref(0);
const dateRange = ref<string[]>([]);

const query = reactive({
  module: '',
  username: '',
  result: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

/** 加载操作日志 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getOperationLogsApi({
      page: query.page,
      pageSize: query.pageSize,
      module: query.module || undefined,
      username: query.username || undefined,
      result: query.result,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/** 查询 */
function handleSearch(): void {
  query.page = 1;
  void loadList();
}

/** 重置 */
function handleReset(): void {
  query.module = '';
  query.username = '';
  query.result = undefined;
  dateRange.value = [];
  query.page = 1;
  void loadList();
}

/** 导出操作日志（P2）：按当前筛选条件导出，不带分页参数 */
async function handleExport(): Promise<void> {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportOperationLogsApi({
      module: query.module || undefined,
      username: query.username || undefined,
      result: query.result,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
    });
    downloadBlob(blob, `操作日志_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.csv`);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  } finally {
    exporting.value = false;
  }
}

/** 方法列标签配色：读操作绿、新增蓝、修改黄、删除红 */
type EpTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info';
function methodTag(method: string): EpTagType {
  switch (String(method ?? '').toUpperCase()) {
    case 'GET':
      return 'success';
    case 'POST':
      return 'primary';
    case 'PUT':
    case 'PATCH':
      return 'warning';
    case 'DELETE':
      return 'danger';
    default:
      return 'info';
  }
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="log-operation-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="模块">
        <el-input v-model="query.module" placeholder="请输入模块" clearable />
      </el-form-item>
      <el-form-item label="操作人">
        <el-input v-model="query.username" placeholder="请输入操作人" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <template #advanced>
        <el-form-item label="结果">
          <el-select v-model="query.result" placeholder="全部" clearable style="width: 140px">
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作时间">
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
        <span class="text-[15px] font-semibold text-ink">操作日志</span>
        <div class="flex items-center gap-2">
          <el-button
            v-permission="'log:operation:export'"
            type="primary"
            :icon="BIconDownload"
            :loading="exporting"
            @click="handleExport"
          >
            导出
          </el-button>
          <el-button :icon="BIconArrowClockwise" @click="loadList">刷新</el-button>
        </div>
      </div>

      <Table v-loading="loading" :data="list">
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="action" label="动作" width="110" />
        <el-table-column prop="username" label="操作人" width="120" />
        <el-table-column prop="method" label="方法" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="methodTag(row.method)" size="small">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="url" label="URL" min-width="180" show-overflow-tooltip />
        <el-table-column prop="params" label="参数" min-width="200" show-overflow-tooltip />
        <el-table-column label="耗时" width="100" align="center">
          <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
        </el-table-column>
        <el-table-column label="结果" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === 1 ? 'success' : 'danger'" size="small">
              {{ row.result === 1 ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </Table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="loadList"
        @current-change="loadList"
      />
    </el-card>
  </div>
</template>
