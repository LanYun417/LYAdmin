<script setup lang="ts">
/**
 * 用户 CSV 导入弹窗。
 *
 * 交互要点：
 * - 先给模板下载（不下载模板的用户几乎必然填错列）；
 * - 只在**全部行通过**时才会写入数据（服务端口径），所以报告区要明确告诉用户
 *   "没有任何数据被写入"，避免他以为导入了一半；
 * - 报告按行号排序展示，前 3 行失败原因直接摘出来提示，完整清单留在表格里。
 */
import { ElMessage } from '@/utils/element';
import { getUserImportTemplateApi, importUsersApi } from '@/api/user';
import { downloadBlob } from '@/utils/download';
import type { UserImportResult } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  /** 导入成功（或至少提交过）后通知父页刷新列表 */
  (event: 'imported'): void;
}>();

/** 单文件大小上限（与服务端 multer 限制一致，超了服务端也会拒） */
const MAX_SIZE = 2 * 1024 * 1024;

const file = ref<File | null>(null);
const submitting = ref(false);
/** 导入报告（null = 还没导入过） */
const report = ref<UserImportResult | null>(null);

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** 重置弹窗状态（每次打开都是干净的一张表） */
function resetState(): void {
  file.value = null;
  report.value = null;
}

watch(visible, (value) => {
  if (value) {
    resetState();
  }
});

/** 选文件：只认 CSV，并做大小预检（服务端还会再校验一次，这里只为即时反馈） */
function handleFileChange(uploadFile: { raw?: File }): void {
  const picked = uploadFile.raw;
  if (!picked) {
    return;
  }
  if (!picked.name.toLowerCase().endsWith('.csv')) {
    ElMessage.error('请选择 CSV 文件（Excel / WPS 请另存为 CSV）');
    file.value = null;
    return;
  }
  if (picked.size > MAX_SIZE) {
    ElMessage.error('文件不能超过 2MB');
    file.value = null;
    return;
  }
  file.value = picked;
  report.value = null;
}

/** 下载模板 */
async function handleDownloadTemplate(): Promise<void> {
  const blob = await getUserImportTemplateApi();
  downloadBlob(blob, 'users-import-template.csv');
}

/** 提交导入 */
async function handleSubmit(): Promise<void> {
  if (!file.value || submitting.value) {
    return;
  }
  submitting.value = true;
  try {
    const result = await importUsersApi(file.value);
    report.value = result;
    if (result.created > 0) {
      ElMessage.success(`成功导入 ${result.created} 条`);
      emit('imported');
    } else {
      const preview = result.failed
        .slice(0, 3)
        .map((item) => `第 ${item.line} 行 ${item.username}：${item.message}`)
        .join('；');
      ElMessage.error(`全部 ${result.total} 行未通过校验，未写入任何数据 —— ${preview}`);
    }
  } catch {
    // 失败提示由请求层统一弹出（如空文件、缺必填列、超出大小限制）
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog v-model="visible" title="批量导入用户" width="720px" :show-footer="false">
    <el-alert type="info" :closable="false" class="mb-4">
      <template #title>
        导入规则：<strong>全成功或全不写</strong> —— 任意一行校验不通过，整批都不会写入。
        请先下载模板，表头不要改动（括号内的说明可保留）。
      </template>
    </el-alert>

    <div class="flex items-center gap-3 mb-4">
      <el-button @click="handleDownloadTemplate">
        <template #icon><i class="bi bi-download" /></template>
        下载模板
      </el-button>
      <span class="text-sm text-muted">模板含账号 / 昵称 / 密码等列，示例行可删除</span>
    </div>

    <el-upload :auto-upload="false" :limit="1" accept=".csv" :show-file-list="false" :on-change="handleFileChange">
      <el-button :disabled="submitting">
        <template #icon><i class="bi bi-folder2-open" /></template>
        选择 CSV 文件
      </el-button>
    </el-upload>
    <div v-if="file" class="mt-2 text-sm text-muted">已选择：{{ file.name }}</div>

    <el-button v-if="report" class="mt-4" type="primary" :loading="submitting" :disabled="!file" @click="handleSubmit">
      重新导入
    </el-button>
    <el-button v-else class="mt-4" type="primary" :loading="submitting" :disabled="!file" @click="handleSubmit">
      开始导入
    </el-button>

    <template v-if="report">
      <el-alert class="mt-4" :type="report.created > 0 ? 'success' : 'error'" :closable="false" show-icon>
        <template #title>
          共 {{ report.total }} 行；
          <template v-if="report.created > 0">
            成功写入 <strong>{{ report.created }}</strong> 条
          </template>
          <template v-else>
            <strong>未写入任何数据</strong>，失败 {{ report.failed.length }} 行，请按下表修正后重新导入
          </template>
        </template>
      </el-alert>

      <el-table v-if="report.failed.length > 0" class="mt-3" :data="report.failed" max-height="280" border size="small">
        <el-table-column prop="line" label="行号" width="80" align="center" />
        <el-table-column prop="username" label="账号" width="160" show-overflow-tooltip />
        <el-table-column prop="message" label="失败原因" min-width="240" show-overflow-tooltip />
      </el-table>
    </template>
  </BasicDialog>
</template>
