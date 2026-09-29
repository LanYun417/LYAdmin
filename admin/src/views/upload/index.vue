<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import type { UploadRequestOptions } from 'element-plus';
import { BIconArrowClockwise, BIconFileEarmark, BIconFileEarmarkImage, BIconUpload } from 'bootstrap-icons-vue';
import {
  checkFileApi,
  deleteFileApi,
  downloadFileApi,
  getFileListApi,
  getFileTypesApi,
  getFileUploadersApi,
  uploadFilesApi,
} from '@/api/file';
import { downloadBlob } from '@/utils/download';
import { sha256Hex } from '@/utils/hash';
import { formatFileSize, formatDateTime } from '@/utils/format';
import type { FileItem, FileUploaderOption } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'Upload' });

/** KB → 字节换算（表单按 KB 录入，接口按字节过滤） */
const BYTES_PER_KB = 1024;

const loading = ref(false);
const fileList = ref<FileItem[]>([]);
const total = ref(0);
/** 文件类型选项：库内 mimeType 去重结果，新增类型自动同步，无硬编码 */
const typeOptions = ref<string[]>([]);
/** 上传人选项：库内 uploader_id 去重后关联用户表，动态生成 */
const uploaderOptions = ref<FileUploaderOption[]>([]);
/** 上传时间范围（与日志模块一致：value-format 直接产出字符串） */
const dateRange = ref<string[]>([]);

const query = reactive({
  page: 1,
  pageSize: 20,
  originName: '',
  mimeType: '',
  uploaderId: undefined as number | undefined,
  minSizeKB: undefined as number | undefined,
  maxSizeKB: undefined as number | undefined,
});

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

/** 加载文件列表（多条件组合查询） */
async function loadFiles(): Promise<void> {
  loading.value = true;
  try {
    const res = await getFileListApi({
      page: query.page,
      pageSize: query.pageSize,
      originName: query.originName.trim() || undefined,
      mimeType: query.mimeType || undefined,
      uploaderId: query.uploaderId,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
      minSize: query.minSizeKB === undefined ? undefined : Math.round(query.minSizeKB * BYTES_PER_KB),
      maxSize: query.maxSizeKB === undefined ? undefined : Math.round(query.maxSizeKB * BYTES_PER_KB),
    });
    fileList.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch {
    fileList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** 加载筛选下拉选项（文件类型 / 上传人，均来自库内去重查询） */
async function loadFilterOptions(): Promise<void> {
  try {
    typeOptions.value = await getFileTypesApi();
  } catch {
    typeOptions.value = [];
  }
  try {
    uploaderOptions.value = await getFileUploadersApi();
  } catch {
    uploaderOptions.value = [];
  }
}

/** 查询：回到第 1 页重新拉取 */
function handleSearch(): void {
  query.page = 1;
  void loadFiles();
}

/** 重置：清空全部筛选条件并回到第 1 页 */
function handleReset(): void {
  query.originName = '';
  query.mimeType = '';
  query.uploaderId = undefined;
  query.minSizeKB = undefined;
  query.maxSizeKB = undefined;
  dateRange.value = [];
  query.page = 1;
  void loadFiles();
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
  // 新文件可能带来新的 MIME 类型 / 上传人，同步刷新下拉，保证选项与库中数据一致
  await loadFilterOptions();
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

/** 下载文件：拉二进制流后由浏览器落盘（文件名用原始文件名） */
async function handleDownload(row: FileItem): Promise<void> {
  const blob = await downloadFileApi(row.id);
  downloadBlob(blob, row.originName);
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
  void loadFilterOptions();
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

    <SearchForm class="mt-4" @search="handleSearch" @reset="handleReset">
      <el-form-item label="文件名">
        <el-input
          v-model="query.originName"
          placeholder="请输入文件名"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="文件类型">
        <el-select v-model="query.mimeType" placeholder="全部" clearable style="width: 190px">
          <el-option v-for="item in typeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="上传人">
        <el-select v-model="query.uploaderId" placeholder="全部" clearable style="width: 150px">
          <el-option
            v-for="item in uploaderOptions"
            :key="item.id"
            :label="item.nickname || item.username"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="上传时间">
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
      <el-form-item label="大小(KB)">
        <div class="flex items-center gap-1">
          <el-input-number
            v-model="query.minSizeKB"
            :min="0"
            :controls="false"
            placeholder="最小"
            style="width: 80px"
          />
          <span class="text-muted">-</span>
          <el-input-number
            v-model="query.maxSizeKB"
            :min="0"
            :controls="false"
            placeholder="最大"
            style="width: 80px"
          />
        </div>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span>文件列表</span>
          <el-button :icon="BIconArrowClockwise" size="small" @click="loadFiles">刷新</el-button>
        </div>
      </template>
      <Table v-loading="loading" :data="fileList">
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
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-link type="primary" :href="row.fileUrl" target="_blank" rel="noopener" class="mr-3"> 查看 </el-link>
            <el-button v-permission="'file:download'" type="success" link @click="handleDownload(row as FileItem)">
              下载
            </el-button>
            <el-button v-permission="'file:remove'" type="danger" link @click="handleDelete(row as FileItem)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </Table>
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
