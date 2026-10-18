<script setup lang="ts">
/** 操作日志页。模块职责：按模块、操作人、结果与时间范围查询操作记录并导出 CSV。 */

import { ElMessage } from '@/utils/element';
import { deleteOperationLogApi, deleteOperationLogsApi, exportOperationLogsApi, getOperationLogsApi } from '@/api/log';
import { useTable } from '@/composables/useTable';
import { useLogDelete } from '@/composables/useLogDelete';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import type { OperationLog } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogOperation' });

const exporting = ref(false);
const dateRange = ref<string[]>([]);

const { loading, list, total, query, getList, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getOperationLogsApi({
      page: p.page,
      pageSize: p.pageSize,
      module: p.module || undefined,
      username: p.username || undefined,
      result: p.result,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
    }),
  { module: '', username: '', result: undefined as number | undefined },
);

/** 单条 / 多选删除（二次确认、删除后回退空页） */
const { selected, deleting, handleSelectionChange, removeOne, removeSelected } = useLogDelete<OperationLog>({
  batchApi: deleteOperationLogsApi,
  singleApi: deleteOperationLogApi,
  list,
  query,
  getList,
});

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
</script>

<template>
  <div class="log-operation-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="模块">
        <el-input v-model="query.module" placeholder="请输入模块" clearable />
      </el-form-item>
      <el-form-item label="操作人">
        <el-input v-model="query.username" placeholder="请输入操作人" clearable @keyup.enter="search" />
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
          <el-button @click="getList">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>刷新</el-button
          >
          <el-button v-permission="'log:operation:export'" type="primary" :loading="exporting" @click="handleExport">
            <template #icon><i class="bi bi-download" /></template>
            导出
          </el-button>
          <el-button
            v-permission="'log:operation:remove'"
            type="danger"
            plain
            :loading="deleting"
            :disabled="selected.length === 0"
            @click="removeSelected"
          >
            <template #icon><i class="bi bi-trash" /></template>
            删除{{ selected.length > 0 ? `（${selected.length}）` : '' }}
          </el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" />
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
        <el-table-column prop="location" label="归属地" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.location || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-permission="'log:operation:remove'" type="danger" link @click="removeOne(row as OperationLog)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

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
