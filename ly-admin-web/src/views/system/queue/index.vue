<script setup lang="ts">
/**
 * 任务队列页。
 * 模块职责：队列任务列表（状态/重试/退避时间）、重放、手动消费。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { consumeQueueApi, listQueueJobsApi, replayJobApi } from '@/api/queue';
import type { QueueJob } from '@/types/api';

defineOptions({ name: 'SystemQueue' });

const loading = ref(false);
const jobs = ref<QueueJob[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: '', type: '' });

/** 状态标签映射。 */
const STATUS_LABELS: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: '待执行', type: 'info' },
  running: { label: '执行中', type: 'warning' },
  done: { label: '成功', type: 'success' },
  dead: { label: '已放弃', type: 'danger' },
};

async function loadJobs(): Promise<void> {
  loading.value = true;
  try {
    const res = await listQueueJobsApi({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined,
      type: query.type || undefined,
    });
    jobs.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/** 重放 */
async function handleReplay(row: QueueJob): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定重放任务「${row.title}」吗？将清空尝试次数并立即重新入队。`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await replayJobApi(row.id);
  ElMessage.success('已重放');
  await loadJobs();
}

/** 手动消费一次 */
async function handleConsume(): Promise<void> {
  try {
    const result = await consumeQueueApi();
    if (result.processed === 0) {
      ElMessage.info('当前没有到期任务');
    } else {
      ElMessage.success(
        `已处理 ${result.processed} 个（成功 ${result.succeeded} / 待重试 ${result.failed} / 放弃 ${result.dead}）`,
      );
    }
    await loadJobs();
  } catch {
    // 拦截器统一处理
  }
}

onMounted(loadJobs);
</script>

<template>
  <div class="queue-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span>任务队列（{{ total }}）</span>
          <div class="flex gap-2">
            <el-input
              v-model="query.type"
              placeholder="任务类型"
              clearable
              style="width: 180px"
              @keyup.enter="
                query.page = 1;
                loadJobs();
              "
              @clear="
                query.page = 1;
                loadJobs();
              "
            />
            <el-select
              v-model="query.status"
              placeholder="状态"
              clearable
              style="width: 140px"
              @change="
                query.page = 1;
                loadJobs();
              "
            >
              <el-option label="待执行" value="pending" />
              <el-option label="执行中" value="running" />
              <el-option label="成功" value="done" />
              <el-option label="已放弃" value="dead" />
            </el-select>
            <el-button @click="handleConsume">
              <template #icon><i class="bi bi-play" /></template>
              手动消费
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="jobs" row-key="id">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="type" label="类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_LABELS[row.status]?.type ?? 'info'" size="small">
              {{ STATUS_LABELS[row.status]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="尝试次数" width="100" align="center">
          <template #default="{ row }">{{ row.attempts }} / {{ row.maxAttempts }}</template>
        </el-table-column>
        <el-table-column label="下次执行" width="180">
          <template #default="{ row }">{{ new Date(row.availAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="错误" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="text-danger">{{ row.lastError || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'dead' || row.status === 'done'"
              type="primary"
              link
              @click="handleReplay(row as QueueJob)"
            >
              重放
            </el-button>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > 0" class="mt-3 flex justify-end">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="loadJobs"
          @size-change="
            query.page = 1;
            loadJobs();
          "
        />
      </div>
    </el-card>
  </div>
</template>
