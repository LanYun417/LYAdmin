<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadRequestOptions } from 'element-plus';
import { BIconArrowClockwise, BIconFileEarmark, BIconFileEarmarkImage, BIconUpload } from 'bootstrap-icons-vue';
import { deleteFileApi, checkFileApi, getFileListApi, uploadFilesApi } from '@/api/file';
import { sha256Hex } from '@/utils/hash';
import { formatFileSize, formatDateTime } from '@/utils/format';
import type { FileItem } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';

defineOptions({ name: 'Upload' });

const loading = ref(false);
const fileList = ref<FileItem[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 10, originName: '' });

/** 允许的文件类型 */
const ACCEPT_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
/** 单文件大小上限 10MB */
const MAX_SIZE = 10 * 1024 * 1024;
/** 列表缩略图等比缩放比例（0.1 = 宽高各为原图 10%），仅用于小尺寸展示，节省带宽 */
const THUMB_SCALE = 0.1;

/**
 * 列表缩略图地址：在原图地址后追加等比缩放参数（scale=0.1）。
 * 原图地址（fileUrl）不含 query，直接拼接；若已带 query 则用 & 追加，避免重复拼接。
 */
function thumbUrl(url: string): string {
  if (!url) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}scale=${THUMB_SCALE}`;
}

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

/** 真正上传文件体 */
async function doUpload(options: UploadRequestOptions, file: File): Promise<void> {
  const res = await uploadFilesApi([file]);
  options.onSuccess?.(res);
  ElMessage.success('上传成功');
  await loadFiles();
}

/**
 * 自定义上传：先算哈希预检，命中库内已有内容则静默秒传——不上传
 * 文件体、不提示重复、也不新增任何记录（库内已有该文件），对外
 * 与正常上传表现一致；未命中则正常上传。
 */
async function customUpload(options: UploadRequestOptions): Promise<void> {
  const file = options.file as unknown as File;
  try {
    const hash = await sha256Hex(file);
    const check = await checkFileApi(hash);

    if (check.exists) {
      // 静默秒传：库内已有同内容文件，不重复上传也不新增记录
      options.onSuccess?.(null);
      ElMessage.success('上传成功');
      return;
    }

    await doUpload(options, file);
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
        v-permission="'file:upload'"
        drag
        multiple
        :show-file-list="false"
        :accept="ACCEPT_TYPES"
        :before-upload="beforeUpload"
        :http-request="customUpload"
      >
        <el-icon class="text-5xl text-faint"><BIconUpload /></el-icon>
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
      <el-table v-loading="loading" :data="fileList">
        <el-table-column label="预览" width="88" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.mimeType?.startsWith('image/')"
              class="block w-12 h-12 overflow-hidden border border-line-lighter rounded-md cursor-zoom-in"
              :src="thumbUrl(row.fileUrl)"
              :preview-src-list="[row.fileUrl]"
              preview-teleported
              fit="cover"
              lazy
            >
              <template #error>
                <div class="w-full h-full flex-center text-[22px] text-muted bg-fill-light rounded-md">
                  <el-icon><BIconFileEarmarkImage /></el-icon>
                </div>
              </template>
            </el-image>
            <div
              v-else
              class="w-12 h-12 flex-center text-[22px] text-muted bg-fill-light border border-line-lighter rounded-md"
            >
              <el-icon><BIconFileEarmark /></el-icon>
            </div>
          </template>
        </el-table-column>
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
            <el-button v-permission="'file:remove'" type="danger" link @click="handleDelete(row as FileItem)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>
