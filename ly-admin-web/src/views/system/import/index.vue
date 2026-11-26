<script setup lang="ts">
/**
 * 数据导入中心页。
 * 模块职责：选择导入类型 → 上传文件 → 队列异步执行 → 记录与逐行失败报告。
 */

import { ref } from 'vue';
import { ElMessage } from '@/utils/element';
import { listImportRecordsApi, listImportTypesApi, submitImportApi } from '@/api/import';
import type { ImportRecord } from '@/types/api';

defineOptions({ name: 'SystemImport' });

/* ------------------------------- 上传区 ------------------------------- */

const types = ref<Array<{ type: string; title: string }>>([]);
const activeType = ref('');
const uploading = ref(false);

onMounted(async () => {
  types.value = await listImportTypesApi();
  if (types.value.length > 0) {
    activeType.value = types.value[0].type;
  }
});

/** 上传前校验：类型 + 文件类型 */
function beforeUpload(file: File): boolean {
  if (!activeType.value) {
    ElMessage.warning('请先选择导入类型');
    return false;
  }
  const isCsv = /\.csv$/i.test(file.name);
  if (!isCsv) {
    ElMessage.error('仅支持 .csv 文件（请先下载模板填写）');
    return false;
  }
  return true;
}

/** 自定义上传：入队即受理 */
async function handleUpload(options: { file: File }): Promise<void> {
  uploading.value = true;
  try {
    const res = await submitImportApi(activeType.value, options.file);
    ElMessage.success(`已受理导入任务 #${res.jobId}，完成后将通知您`);
    await loadRecords();
  } catch {
    // 拦截器统一处理
  } finally {
    uploading.value = false;
  }
}

/* ------------------------------- 记录区 ------------------------------- */

const loading = ref(false);
const records = ref<ImportRecord[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20 });

/** 失败报告弹窗。 */
const detailVisible = ref(false);
const detail = ref<ImportRecord | null>(null);

async function loadRecords(): Promise<void> {
  loading.value = true;
  try {
    const res = await listImportRecordsApi({ page: query.page, pageSize: query.pageSize });
    records.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecords);

/** 状态映射。 */
const STATUS_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  ok: { label: '全部成功', type: 'success' },
  partial: { label: '部分失败', type: 'warning' },
  failed: { label: '全部失败', type: 'danger' },
};
</script>

<template>
  <div class="import-page">
    <el-card shadow="never" class="mb-4">
      <template #header><span>上传导入</span></template>
      <div class="flex flex-wrap items-center gap-3">
        <el-select v-model="activeType" placeholder="选择导入类型" style="width: 200px">
          <el-option v-for="item in types" :key="item.type" :label="item.title" :value="item.type" />
        </el-select>
        <el-upload :show-file-list="false" :before-upload="beforeUpload" :http-request="handleUpload">
          <el-button type="primary" :loading="uploading">
            <template #icon><i class="bi bi-upload" /></template>
            上传 CSV 并入队
          </el-button>
        </el-upload>
        <span class="text-xs text-muted">
          导入为异步执行：上传后立即返回，执行结果将通过站内通知告知；单次上限 2 万行。
        </span>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header
        ><span>导入记录（{{ total }}）</span></template
      >
      <el-table v-loading="loading" :data="records" row-key="id">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="140" show-overflow-tooltip />
        <el-table-column prop="fileName" label="文件" min-width="160" show-overflow-tooltip />
        <el-table-column label="行数" width="140" align="center">
          <template #default="{ row }">{{ row.created }} / {{ row.total }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type ?? 'info'" size="small">
              {{ STATUS_MAP[row.status]?.label ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.failed && row.failed.length > 0"
              type="primary"
              link
              @click="
                detail = row as ImportRecord;
                detailVisible = true;
              "
            >
              失败报告
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
          @current-change="loadRecords"
          @size-change="
            query.page = 1;
            loadRecords();
          "
        />
      </div>
    </el-card>

    <!-- 逐行失败报告 -->
    <el-dialog v-model="detailVisible" title="失败报告" width="640px">
      <el-table :data="detail?.failed ?? []" row-key="row" max-height="420">
        <el-table-column prop="row" label="行号" width="100" align="center" />
        <el-table-column prop="message" label="失败原因" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>
