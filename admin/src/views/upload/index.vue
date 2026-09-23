<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadRequestOptions } from 'element-plus';
import { BIconArrowClockwise, BIconTrash, BIconUpload } from 'bootstrap-icons-vue';
import { deleteFileApi, getFileListApi, uploadFilesApi } from '@/api/file';
import { formatFileSize, formatDateTime } from '@/utils/format';
import type { FileItem } from '@/types/api';

defineOptions({ name: 'Upload' });

const loading = ref(false);
const fileList = ref<FileItem[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 10, originName: '' });

/** 允许的文件类型 */
const ACCEPT_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
/** 单文件大小上限 10MB */
const MAX_SIZE = 10 * 1024 * 1024;

/** 加载文件列表 */
async function loadFiles(): Promise<void> {
  loading.value = true;
  try {
    const res = await getFileListApi({ ...query });
    fileList.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch {
    fileList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** 上传前校验 */
function beforeUpload(file: File): boolean {
  if (file.size > MAX_SIZE) {
    ElMessage.error('单个文件大小不能超过 10MB');
    return false;
  }
  return true;
}

/** 自定义上传 */
async function customUpload(options: UploadRequestOptions): Promise<void> {
  try {
    const res = await uploadFilesApi([options.file as unknown as File]);
    options.onSuccess?.(res);
    ElMessage.success('上传成功');
    await loadFiles();
  } catch (error) {
    options.onError?.(error as Parameters<NonNullable<UploadRequestOptions['onError']>>[0]);
  }
}

/** 删除文件 */
async function handleDelete(row: FileItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除文件「${row.originName}」吗？`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteFileApi(row.id);
  ElMessage.success('删除成功');
  await loadFiles();
}

/** 分页变化 */
function handlePageChange(): void {
  void loadFiles();
}

onMounted(() => {
  void loadFiles();
});
</script>

<template>
  <div class="upload-page">
    <el-card shadow="never">
      <template #header>文件上传</template>
      <el-upload
        drag
        multiple
        :show-file-list="false"
        :accept="ACCEPT_TYPES"
        :before-upload="beforeUpload"
        :http-request="customUpload"
      >
        <el-icon class="upload-icon"><BIconUpload /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持图片 / 文档 / 压缩包，单个文件不超过 10MB，单次最多 10 个</div>
        </template>
      </el-upload>
    </el-card>

    <el-card shadow="never" class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>文件列表</span>
          <el-button :icon="BIconArrowClockwise" size="small" @click="loadFiles">刷新</el-button>
        </div>
      </template>
      <el-table v-loading="loading" :data="fileList" border stripe>
        <el-table-column prop="originName" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="mimeType" label="类型" width="160" show-overflow-tooltip />
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-link type="primary" :href="row.fileUrl" target="_blank" rel="noopener" class="mr-3"> 查看 </el-link>
            <el-button type="danger" link :icon="BIconTrash" @click="handleDelete(row as FileItem)"> 删除 </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end mt-4">
        <el-pagination
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @size-change="
            (s: number) => {
              query.pageSize = s;
              query.page = 1;
              handlePageChange();
            }
          "
          @current-change="
            (p: number) => {
              query.page = p;
              handlePageChange();
            }
          "
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.upload-icon {
  font-size: 48px;
  color: var(--el-text-color-placeholder);
}
</style>
