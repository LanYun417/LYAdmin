<script setup lang="ts">
/**
 * 大文件分片上传对话框。
 * 模块职责：文件选择 → 分片上传（并发/重试/暂停/恢复/取消/断点续传）→ 合并。
 *
 * 设计取舍：
 * - 小文件（≤ DIRECT_UPLOAD_LIMIT）仍走列表页原有的一键上传，本对话框只面向
 *   超出直传上限的大文件；
 * - 每个文件一个 ChunkUploadController（状态机在 utils/chunkedFile.ts，可单测），
 *   组件只负责把控制器状态同步进响应式条目并渲染；
 * - 上传标识 = 采样哈希（头中尾各 2MB）：换浏览器/断网重进都能凭 status 续传；
 *   真正的秒传发生在合并时（服务端流式全量哈希）。
 */
import { shallowRef } from 'vue';
import { ElMessage } from '@/utils/element';
import { cancelChunksApi, chunkStatusApi, mergeChunksApi, uploadChunkApi } from '@/api/file';
import { ChunkUploadController, formatChunkFileSize, uploadPercent, type ChunkUploadState } from '@/utils/chunkedFile';

const emit = defineEmits<{
  (e: 'uploaded'): void;
}>();

/** 超过该大小的文件建议走分片（与直传上限 10MB 对齐，留出重叠区由用户自选）。 */
const DIRECT_UPLOAD_LIMIT = 10 * 1024 * 1024;

const visible = defineModel<boolean>({ required: true });

/** 一行 = 一个文件的任务（控制器 + 状态快照）。 */
interface UploadEntry {
  key: number;
  controller: ChunkUploadController;
  state: ChunkUploadState;
}

/**
 * 任务列表用 shallowRef：控制器是类实例，深响应代理会把它的类型结构化成
 * 「缺私有成员」而处处报错；shallow 下条目是原样对象，状态更新靠**整体
 * 替换数组**触发渲染。
 */
const entries = shallowRef<UploadEntry[]>([]);

let keySeed = 0;

/** 把控制器最新状态同步进响应式条目（替换数组触发渲染，控制器实例保持原样）。 */
function syncState(key: number): void {
  entries.value = entries.value.map((item) =>
    item.key === key ? { ...item, state: { ...item.controller.state } } : item,
  );
}

/** 选择文件：每个文件建一个控制器并立即开始。 */
function handleFiles(files: FileList | null): void {
  if (!files || files.length === 0) {
    return;
  }
  for (const file of Array.from(files)) {
    if (file.size === 0) {
      ElMessage.warning(`「${file.name}」是空文件，已跳过`);
      continue;
    }
    const key = (keySeed += 1);
    const controller = new ChunkUploadController(file, {
      uploadChunk: uploadChunkApi,
      status: chunkStatusApi,
      merge: mergeChunksApi,
      cancel: cancelChunksApi,
      onState: () => syncState(key),
      onDone: () => {
        syncState(key);
        ElMessage.success(`「${file.name}」上传成功`);
        emit('uploaded');
      },
      onError: (message) => {
        syncState(key);
        ElMessage.error(`「${file.name}」上传失败：${message}`);
      },
    });
    entries.value = [...entries.value, { key, controller, state: controller.state }];
    void controller.start();
  }
}

/** 暂停 / 恢复。 */
function togglePause(entry: UploadEntry): void {
  if (entry.state.phase === 'uploading') {
    entry.controller.pause();
    return;
  }
  if (entry.state.phase === 'paused') {
    void entry.controller.resume();
  }
}

/** 取消单个任务。 */
async function cancelOne(entry: UploadEntry): Promise<void> {
  await entry.controller.cancel();
  syncState(entry.key);
}

/** 关闭对话框：有在途任务先取消，避免关窗后还在传。 */
async function handleClose(): Promise<void> {
  const active = entries.value.filter((item) =>
    ['uploading', 'paused', 'hashing', 'merging'].includes(item.state.phase),
  );
  for (const entry of active) {
    await entry.controller.cancel();
  }
  entries.value = [];
}

/** 相位中文文案。 */
const PHASE_TEXT: Record<ChunkUploadState['phase'], string> = {
  idle: '等待中',
  hashing: '计算标识',
  uploading: '上传中',
  paused: '已暂停',
  merging: '合并中',
  done: '已完成',
  error: '失败',
  canceled: '已取消',
};

function phaseText(phase: ChunkUploadState['phase']): string {
  return PHASE_TEXT[phase];
}
</script>

<template>
  <BasicDialog v-model="visible" title="大文件上传（分片）" width="640px" append-to-body @closed="handleClose">
    <div class="flex flex-col gap-4">
      <!-- 选择区 -->
      <div
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-line-light py-6 text-muted hover:border-primary hover:text-primary"
        @click="($refs.fileInput as HTMLInputElement | undefined)?.click()"
      >
        <el-icon class="text-3xl"><i class="bi bi-cloud-arrow-up" /></el-icon>
        <div class="text-sm">点击选择文件（分片上传，支持断点续传与秒传）</div>
        <div class="text-xs">
          单文件超过 {{ formatChunkFileSize(DIRECT_UPLOAD_LIMIT) }} 建议走此处；小文件用列表上方拖拽区更快
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="
          handleFiles(($event.target as HTMLInputElement).files);
          ($event.target as HTMLInputElement).value = '';
        "
      />

      <!-- 任务列表 -->
      <div v-for="entry in entries" :key="entry.key" class="rounded border border-line-light p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-ink" :title="entry.state.file.name">{{ entry.state.file.name }}</div>
            <div class="mt-0.5 text-xs text-muted">
              {{ formatChunkFileSize(entry.state.file.size) }} · {{ entry.state.uploadedChunks }}/{{
                entry.state.totalChunks
              }}
              片 · {{ phaseText(entry.state.phase) }}
              <span v-if="entry.state.error" class="text-danger">{{ entry.state.error }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <el-button v-if="entry.state.phase === 'uploading'" size="small" @click="togglePause(entry)"
              >暂停</el-button
            >
            <el-button v-if="entry.state.phase === 'paused'" size="small" type="primary" @click="togglePause(entry)">
              继续
            </el-button>
            <el-button
              v-if="['uploading', 'paused', 'hashing', 'merging'].includes(entry.state.phase)"
              size="small"
              type="danger"
              link
              @click="cancelOne(entry)"
            >
              取消
            </el-button>
          </div>
        </div>
        <el-progress
          :percentage="uploadPercent(entry.state)"
          :stroke-width="8"
          :show-text="true"
          class="mt-2"
          :status="entry.state.phase === 'error' ? 'exception' : entry.state.phase === 'done' ? 'success' : undefined"
        />
      </div>

      <div v-if="entries.length === 0" class="py-6 text-center text-xs text-muted">暂无上传任务</div>
    </div>
  </BasicDialog>
</template>
