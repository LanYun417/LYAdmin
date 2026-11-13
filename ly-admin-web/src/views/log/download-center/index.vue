<script setup lang="ts">
/**
 * 下载中心（异步导出）。
 * 模块职责：展示我的导出任务（等待/生成中/完成/失败），完成后领取下载。
 *
 * 设计取舍：
 * - 生成中的任务用 3s 轻轮询兜底：SSE 通知只推「完成/失败」事件（notice），
 *   不推进行中的进度百分比；临产状态的刷新靠轮询 + 完成瞬间的通知刷新。
 *   轮询仅在存在未终态任务时进行，无在途任务时完全静止；
 * - 过期任务（expiresAt 已过）下载按钮置灰并提示，文件由后端定时任务清理。
 */
import { onBeforeUnmount, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import { deleteExportTaskApi, downloadExportTaskApi, getExportTasksApi } from '@/api/exportTask';
import { useTable } from '@/composables/useTable';
import { formatDateTime, formatFileSize } from '@/utils/format';
import { ExportTaskStatus } from '@/types/api';
import type { ExportTaskItem } from '@/types/api';
import TablePage from '@/components/TablePage/index.vue';

defineOptions({ name: 'LogDownloadCenter' });

const { loading, list, total, query, getList, search, changePage, changePageSize } = useTable<ExportTaskItem>(
  (p) =>
    getExportTasksApi({
      page: p.page,
      pageSize: p.pageSize,
    }),
  {},
);

/** 状态 → 标签样式（与颜色语义一致：成功=绿 / 失败=红 / 在途=蓝/灰）。 */
const STATUS_TAG: Record<number, { type: 'success' | 'danger' | 'warning' | 'info'; effect: 'dark' | 'plain' }> = {
  [ExportTaskStatus.PENDING]: { type: 'info', effect: 'plain' },
  [ExportTaskStatus.PROCESSING]: { type: 'warning', effect: 'plain' },
  [ExportTaskStatus.DONE]: { type: 'success', effect: 'dark' },
  [ExportTaskStatus.FAILED]: { type: 'danger', effect: 'plain' },
};

function statusTag(status: number): { type: 'success' | 'danger' | 'warning' | 'info'; effect: 'dark' | 'plain' } {
  return STATUS_TAG[status] ?? { type: 'info', effect: 'plain' };
}

/** 是否已过期（文件被清理后不可下载）。 */
function isExpired(row: ExportTaskItem): boolean {
  if (!row.expiresAt) {
    return false;
  }
  return new Date(row.expiresAt).getTime() < Date.now();
}

/** 下载（文件可能已被清理：失败提示由请求层给出，这里补一条可读文案）。 */
async function handleDownload(row: ExportTaskItem): Promise<void> {
  if (!row.downloadable) {
    ElMessage.warning('文件已被清理或任务未完成，无法下载');
    return;
  }
  try {
    await downloadExportTaskApi(row.id, row.fileName ?? `导出_${row.id}.csv`);
  } catch {
    ElMessage.error('下载失败，文件可能已被清理');
  }
}

/** 删除任务（二次确认）。 */
async function handleRemove(row: ExportTaskItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除导出任务「${row.moduleLabel}」吗？文件将一并删除。`, '删除任务', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteExportTaskApi((row as ExportTaskItem).id);
  ElMessage.success('已删除');
  await getList();
}

/* ------------------------------ 在途任务轻轮询 ------------------------------ */

let timer: ReturnType<typeof setInterval> | null = null;

/** 有未终态任务才轮询，避免无事可做时白烧请求。 */
function syncPolling(): void {
  const hasPending = list.value.some(
    (row) => row.status === ExportTaskStatus.PENDING || row.status === ExportTaskStatus.PROCESSING,
  );
  if (hasPending && timer === null) {
    timer = setInterval(() => void getList(), 3000);
    return;
  }
  if (!hasPending && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

onMounted(async () => {
  await getList();
  syncPolling();
});

onBeforeUnmount(() => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
});

// 列表变化后重新评估轮询需要
watch(list, syncPolling, { deep: true });
</script>

<template>
  <div class="download-center-page">
    <TablePage
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      title="下载中心"
      :loading="loading"
      :data="list"
      :total="total"
      @search="search"
      @current-change="changePage"
      @size-change="changePageSize"
    >
      <el-table-column label="模块" prop="moduleLabel" width="140" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag
            :type="statusTag((row as ExportTaskItem).status).type"
            :effect="statusTag((row as ExportTaskItem).status).effect"
            size="small"
          >
            {{ row.statusText }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="行数" prop="total" width="100" />
      <el-table-column label="大小" width="120">
        <template #default="{ row }">{{
          (row as ExportTaskItem).size > 0 ? formatFileSize((row as ExportTaskItem).size) : '-'
        }}</template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.message" class="text-danger">{{ row.message }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="过期时间" width="180">
        <template #default="{ row }">
          <span v-if="row.expiresAt" :class="isExpired(row as ExportTaskItem) ? 'text-faint' : ''">
            {{ formatDateTime((row as ExportTaskItem).expiresAt) }}
            <el-tag v-if="isExpired(row as ExportTaskItem)" type="info" size="small" effect="plain">已过期</el-tag>
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.downloadable"
            type="primary"
            link
            size="small"
            @click="handleDownload(row as ExportTaskItem)"
          >
            下载
          </el-button>
          <el-button v-else type="primary" link size="small" disabled>下载</el-button>
          <el-button type="danger" link size="small" @click="handleRemove(row as ExportTaskItem)">删除</el-button>
        </template>
      </el-table-column>
    </TablePage>
  </div>
</template>
