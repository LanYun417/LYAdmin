<script setup lang="ts">
/** 操作日志页。模块职责：按模块、操作人、结果与时间范围查询操作记录并导出 CSV。 */

import { ElMessage } from '@/utils/element';
import { deleteOperationLogApi, deleteOperationLogsApi, exportOperationLogsApi, getOperationLogsApi } from '@/api/log';
import { useTable } from '@/composables/useTable';
import { useBatchDelete } from '@/composables/useBatchDelete';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import type { OperationLog } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogOperation' });

const exporting = ref(false);
const dateRange = ref<string[]>([]);

/* ------------------------------ 变更留痕 ------------------------------ */

/** 变更留痕弹窗 */
const snapshotVisible = ref(false);
const snapshotRow = ref<OperationLog | null>(null);

/** 一行变更对比。 */
interface SnapshotDiffRow {
  field: string;
  before: string;
  after: string;
  changed: boolean;
}

/** 解析 JSON 文本为对象（空/非法一律当作空对象，不抛错打断渲染）。 */
function parseSnapshot(text: string | null | undefined): Record<string, unknown> {
  if (!text) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** 单元格展示值（对象/数组走紧凑 JSON，null/空 统一显示 '-'）。 */
function formatSnapshotValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * 字段级对比：取前后键的并集逐字段比对。
 * 只做「值是否相等」的判断（不做文本 diff）——审计关心的是"哪个字段被改了"。
 */
const snapshotDiff = computed<SnapshotDiffRow[]>(() => {
  const before = parseSnapshot(snapshotRow.value?.beforeData);
  const after = parseSnapshot(snapshotRow.value?.afterData);
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return fields.map((field) => {
    const beforeText = formatSnapshotValue(before[field]);
    const afterText = formatSnapshotValue(after[field]);
    return { field, before: beforeText, after: afterText, changed: beforeText !== afterText };
  });
});

/** 是否记录了变更前后值（未采集的接口为 null） */
function hasSnapshot(row: OperationLog): boolean {
  return Boolean(row.beforeData || row.afterData);
}

/** 打开变更留痕弹窗 */
function openSnapshot(row: OperationLog): void {
  snapshotRow.value = row;
  snapshotVisible.value = true;
}

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
const { selected, deleting, handleSelectionChange, removeOne, removeSelected } = useBatchDelete<OperationLog>({
  batchApi: deleteOperationLogsApi,
  singleApi: deleteOperationLogApi,
  // 批量删除的确认与跳过大小时按业务名词提示
  noun: '日志',
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
        <el-table-column label="变更留痕" width="110" align="center">
          <template #default="{ row }">
            <el-button
              v-if="hasSnapshot(row as OperationLog)"
              type="primary"
              link
              @click="openSnapshot(row as OperationLog)"
            >
              查看变更
            </el-button>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
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

    <!-- 变更留痕：字段级前后对比（只对比值是否相等，不做文本 diff） -->
    <BasicDialog v-model="snapshotVisible" title="变更留痕" width="720px" :show-footer="false">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="模块">{{ snapshotRow?.module || '-' }}</el-descriptions-item>
        <el-descriptions-item label="动作">{{ snapshotRow?.action || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ snapshotRow?.username || '-' }}</el-descriptions-item>
        <el-descriptions-item label="时间">
          {{ snapshotRow ? formatDateTime(snapshotRow.createdAt) : '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-table :data="snapshotDiff" class="mt-4" max-height="360" border size="small">
        <el-table-column prop="field" label="字段" width="140" />
        <el-table-column label="变更前" min-width="200">
          <template #default="{ row }">
            <span :class="row.changed ? 'text-danger' : ''">{{ row.before }}</span>
          </template>
        </el-table-column>
        <el-table-column label="变更后" min-width="200">
          <template #default="{ row }">
            <span :class="row.changed ? 'text-success font-medium' : ''">{{ row.after }}</span>
          </template>
        </el-table-column>
      </el-table>
    </BasicDialog>
  </div>
</template>
