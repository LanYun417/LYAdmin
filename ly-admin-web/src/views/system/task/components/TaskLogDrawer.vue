<script setup lang="ts">
/**
 * 任务执行记录抽屉。
 * 模块职责：展示某个定时任务的历史执行记录（分页 + 按状态/触发方式筛选）。
 */
import { getTaskLogsApi } from '@/api/task';
import { formatDateTime, formatDuration } from '@/utils/format';
import { useTable } from '@/composables/useTable';
import { useResponsiveSize } from '@/composables/useResponsiveSize';
import type { TaskLogItem } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';

defineOptions({ name: 'TaskLogDrawer' });

const props = defineProps<{
  /** 抽屉可见性 */
  modelValue: boolean;
  /** 任务标识 */
  taskName?: string;
  /** 任务名称（抽屉标题） */
  taskTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { size: drawerSize } = useResponsiveSize(880);

/** 抽屉内表格的记录数与查询状态 */
const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getTaskLogsApi(props.taskName ?? '', {
      page: p.page,
      pageSize: p.pageSize,
      status: p.status,
      trigger: p.trigger,
    }),
  { status: undefined as number | undefined, trigger: undefined as number | undefined },
  // 抽屉关闭时不拉取；由 watch 在打开时触发
  { immediate: false },
);

/** 执行状态 → 标签样式与短名 */
const STATUS_TAG: Record<number, { type: 'primary' | 'success' | 'danger' | 'warning'; label: string }> = {
  0: { type: 'warning', label: '执行中' },
  1: { type: 'success', label: '成功' },
  2: { type: 'danger', label: '失败' },
};

/** 触发方式 → 短名 */
const TRIGGER_LABEL: Record<number, string> = {
  1: '自动',
  2: '手动',
};

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      query.page = 1;
      void getList();
    }
  },
);

/** 关闭 */
function handleClose(): void {
  emit('update:modelValue', false);
}
</script>

<template>
  <el-drawer :model-value="modelValue" :title="`执行记录 - ${taskTitle ?? ''}`" :size="drawerSize" @close="handleClose">
    <div class="flex h-full flex-col">
      <!-- 筛选条 -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px" @change="search">
          <el-option label="执行中" :value="0" />
          <el-option label="成功" :value="1" />
          <el-option label="失败" :value="2" />
        </el-select>
        <el-select v-model="query.trigger" placeholder="全部触发方式" clearable style="width: 150px" @change="search">
          <el-option label="自动（cron）" :value="1" />
          <el-option label="手动" :value="2" />
        </el-select>
        <el-button @click="reset">重置</el-button>
      </div>

      <!-- 滚动交给 el-scrollbar（与全局内容区一致），避免抽屉里出现原生滚动条 -->
      <el-scrollbar v-loading="loading" class="min-h-0 flex-1">
        <el-table :data="list">
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="STATUS_TAG[row.status as TaskLogItem['status']]?.type ?? 'primary'" size="small">
                {{ STATUS_TAG[row.status as TaskLogItem['status']]?.label ?? '未知' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="触发" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.trigger === 2 ? 'warning' : 'info'" size="small" effect="plain">
                {{ TRIGGER_LABEL[row.trigger as TaskLogItem['trigger']] ?? '未知' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="100" align="center">
            <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
          </el-table-column>
          <el-table-column label="触发人" width="110">
            <template #default="{ row }">{{ row.operator ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="失败原因" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.errorMessage" class="text-danger">{{ row.errorMessage }}</span>
              <span v-else class="text-faint">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-scrollbar>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </div>
  </el-drawer>
</template>
