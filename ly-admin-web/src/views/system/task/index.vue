<script setup lang="ts">
/**
 * 定时任务管理页。
 * 模块职责：查看任务定义与调度状态、查看执行历史、手动触发任务。
 *
 * 任务定义在服务端代码里（唯一事实来源），本页只做「观察 + 手动触发」，
 * 不提供新增/编辑任务——那会让代码与页面出现两套口径。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { getTaskListApi, runTaskApi } from '@/api/task';
import { formatDateTime, formatDuration } from '@/utils/format';
import type { TaskItem } from '@/types/api';
import TaskLogDrawer from './components/TaskLogDrawer.vue';

defineOptions({ name: 'SystemTask' });

const loading = ref(false);
const list = ref<TaskItem[]>([]);

/** 正在手动执行的任务名（用于按钮 loading 与防重复点击） */
const runningName = ref<string>('');

/** 执行记录抽屉 */
const logVisible = ref(false);
const logTaskName = ref('');
const logTaskTitle = ref('');

/** 执行状态 → 标签样式与短名 */
const STATUS_TAG: Record<number, { type: 'primary' | 'success' | 'danger' | 'warning'; label: string }> = {
  0: { type: 'warning', label: '执行中' },
  1: { type: 'success', label: '成功' },
  2: { type: 'danger', label: '失败' },
};

/** 拉取任务列表 */
async function getList(): Promise<void> {
  loading.value = true;
  try {
    list.value = (await getTaskListApi()) ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void getList();
});

/** 打开执行记录抽屉 */
function handleViewLogs(row: TaskItem): void {
  logTaskName.value = row.name;
  logTaskTitle.value = row.title;
  logVisible.value = true;
}

/**
 * 手动触发任务。
 * 同步等待服务端执行完毕（任务本身耗时很短），期间禁用该行的按钮。
 */
async function handleRun(row: TaskItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定立即执行「${row.title}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  runningName.value = row.name;
  try {
    const result = await runTaskApi(row.name);
    ElMessage.success(`「${result.title}」执行成功，耗时 ${formatDuration(result.durationMs)}`);
  } catch {
    // 失败信息已由 request 拦截器统一提示，此处仅刷新列表让状态可见
  } finally {
    runningName.value = '';
    await getList();
  }
}
</script>

<template>
  <div class="system-task-page">
    <el-card shadow="never">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-y-2">
        <span class="text-[15px] font-semibold text-ink">定时任务（{{ list.length }}）</span>
        <el-button @click="getList">
          <template #icon><i class="bi bi-arrow-clockwise" /></template>
          刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column label="任务名称" min-width="150">
          <template #default="{ row }">
            <div class="font-medium text-ink">{{ row.title }}</div>
            <div class="mt-0.5 text-xs text-faint">{{ row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column label="说明" prop="description" min-width="240" show-overflow-tooltip />
        <el-table-column label="调度表达式" width="150">
          <template #default="{ row }">
            <code class="rounded bg-fill-light px-1.5 py-0.5 text-xs text-ink-regular">{{ row.cron }}</code>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="!row.enabled" type="info" size="small">已停用</el-tag>
            <el-tag v-else-if="row.running" type="warning" size="small">执行中</el-tag>
            <el-tag v-else type="success" size="small">运行中</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下次执行" width="170">
          <template #default="{ row }">
            <span v-if="row.nextRunAt">{{ formatDateTime(row.nextRunAt) }}</span>
            <span v-else class="text-faint">—</span>
          </template>
        </el-table-column>
        <el-table-column label="上次执行" width="180">
          <template #default="{ row }">
            <div v-if="row.lastRun" class="flex items-center gap-1.5">
              <el-tag :type="STATUS_TAG[row.lastRun.status]?.type ?? 'primary'" size="small">
                {{ STATUS_TAG[row.lastRun.status]?.label ?? '未知' }}
              </el-tag>
              <span class="text-xs text-muted">{{ formatDateTime(row.lastRun.startedAt) }}</span>
            </div>
            <span v-else class="text-faint">从未执行</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleViewLogs(row as TaskItem)">执行记录</el-button>
            <el-button
              v-permission="'system:task:run'"
              type="success"
              link
              :loading="runningName === row.name"
              :disabled="!row.enabled || row.running"
              @click="handleRun(row as TaskItem)"
            >
              立即执行
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <TaskLogDrawer v-model="logVisible" :task-name="logTaskName" :task-title="logTaskTitle" />
  </div>
</template>
