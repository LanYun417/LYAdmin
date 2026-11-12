/**
 * 分片上传的纯逻辑（无框架依赖，可单测）。
 *
 * 与后端契约（ly-admin-api `/files/chunk*`）：
 * - 分片大小 5MB（与 `UPLOAD_CHUNK_SIZE` 默认值一致，末片取余数）；
 * - 上传标识 = 文件「采样哈希」：头 / 中 / 尾各取最多 2MB 拼接后算 SHA-256。
 *   这是**有意的取舍**：10GB 文件先算全量哈希才能秒传，代价不可接受；
 *   真正的秒传发生在合并时（服务端流式全量哈希），采样哈希只做暂存目录名；
 * - 序号从 0 开始，恢复上传前先查 status 对齐已收分片。
 */
import type { FileItem } from '@/types/api';

/** 分片大小（字节，与后端 UPLOAD_CHUNK_SIZE 默认值一致）。 */
export const CHUNK_SIZE = 5 * 1024 * 1024;

/** 采样哈希的每段上限（字节）：头 / 中 / 尾各取最多 2MB。 */
export const SAMPLE_SEGMENT_BYTES = 2 * 1024 * 1024;

/** 单个分片及其序号。 */
export interface FileChunk {
  index: number;
  blob: Blob;
  size: number;
}

/** 上传阶段。 */
export type ChunkUploadPhase = 'idle' | 'hashing' | 'uploading' | 'paused' | 'merging' | 'done' | 'error' | 'canceled';

/** 单个文件的上传状态（UI 直接渲染）。 */
export interface ChunkUploadState {
  /** 上传标识（采样哈希，即服务端分片目录名） */
  identifier: string;
  file: File;
  phase: ChunkUploadPhase;
  /** 已上传分片数 */
  uploadedChunks: number;
  totalChunks: number;
  /** 已上传字节（含历史分片，按 `CHUNK_SIZE × 已收片数 + 末片` 近似即可） */
  uploadedBytes: number;
  error: string | null;
}

/** 控制器依赖（由调用方注入真实 API，测试传假实现）。 */
export interface ChunkUploadDeps {
  uploadChunk: (input: {
    file: Blob;
    identifier: string;
    chunkIndex: number;
    totalChunks: number;
    filename: string;
    totalSize: number;
    signal?: AbortSignal;
  }) => Promise<{ received: number; uploaded: number[] }>;
  status: (identifier: string) => Promise<{ uploaded: number[] }>;
  merge: (input: {
    identifier: string;
    totalChunks: number;
    filename: string;
    totalSize: number;
    mimeType?: string;
  }) => Promise<FileItem>;
  cancel: (identifier: string) => Promise<null>;
  /** 状态变更回调（相位 / 进度推进时触发）。 */
  onState?: (state: ChunkUploadState) => void;
  /** 完成回调。 */
  onDone?: (item: FileItem) => void;
  /** 失败回调（相位进入 error 时调用一次）。 */
  onError?: (message: string) => void;
  /** 并发上传数（默认 3）。 */
  concurrency?: number;
  /** 单分片失败重试次数（默认 2）。 */
  retries?: number;
}

/** 把文件切成「序号 + Blob」列表（末片取余数）。 */
export function splitIntoChunks(file: File | Blob, chunkSize: number = CHUNK_SIZE): FileChunk[] {
  if (chunkSize <= 0) {
    return [{ index: 0, blob: file, size: file.size }];
  }
  const chunks: FileChunk[] = [];
  for (let start = 0, index = 0; start < file.size; start += chunkSize, index += 1) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push({ index, blob: file.slice(start, end), size: end - start });
  }
  return chunks;
}

/**
 * 采样哈希：头 / 中 / 尾各取最多 `SAMPLE_SEGMENT_BYTES` 拼接后算 SHA-256。
 * 小文件（≤ 单段容量）只取一次全量；三段重叠时哈希结果依然确定（只是多算了重复字节），
 * 换取「中小文件绝不漏采中段」的简单正确性。
 */
export async function sampledFileHash(file: File | Blob): Promise<string> {
  const size = file.size;
  const starts = [
    0,
    Math.max(0, Math.floor((size - SAMPLE_SEGMENT_BYTES) / 2)),
    Math.max(0, size - SAMPLE_SEGMENT_BYTES),
  ];
  const parts: Blob[] = [];
  for (const start of new Set(starts)) {
    const end = Math.min(start + SAMPLE_SEGMENT_BYTES, size);
    if (end > start) {
      parts.push(file.slice(start, end));
    }
  }
  const buffer = await new Blob(parts).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 进度百分比（0-100 整数）。 */
export function uploadPercent(state: ChunkUploadState): number {
  if (state.totalChunks === 0) {
    return 0;
  }
  return Math.min(100, Math.round((state.uploadedChunks / state.totalChunks) * 100));
}

/** 人类可读的文件大小。 */
export function formatChunkFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * 单个文件的分片上传控制器（状态机 + 并发 + 重试 + 暂停/恢复/取消）。
 *
 * 用法：UI 每选一个大文件就 new 一个，调 start()；按钮绑 pause/resume/cancel。
 * 所有网络调用走注入的 deps，因此测试可以用假 API 完整驱动。
 */
export class ChunkUploadController {
  /** 已上传序号集合（进度与续传对齐的唯一事实来源）。 */
  private readonly marked = new Set<number>();
  /** 在途请求的中断器（暂停 / 取消时统一 abort）。 */
  private readonly abortControllers = new Set<AbortController>();
  private readonly deps: ChunkUploadDeps & { concurrency: number; retries: number };
  private readonly chunks: FileChunk[];
  private stopped = false;

  readonly state: ChunkUploadState;

  constructor(file: File, deps: ChunkUploadDeps) {
    this.deps = { ...deps, concurrency: deps.concurrency ?? 3, retries: deps.retries ?? 2 };
    this.chunks = splitIntoChunks(file);
    this.state = {
      identifier: '',
      file,
      phase: 'idle',
      uploadedChunks: 0,
      totalChunks: this.chunks.length,
      uploadedBytes: 0,
      error: null,
    };
  }

  /** 开始上传（哈希 → 续传对齐 → 并发上传 → 合并）。 */
  async start(): Promise<void> {
    this.stopped = false;
    try {
      this.setPhase('hashing');
      const identifier = await sampledFileHash(this.state.file);
      this.state.identifier = identifier;

      // 续传对齐：服务端已有分片不重传（换浏览器 / 断网重进都靠它）
      const { uploaded } = await this.deps.status(identifier);
      for (const index of uploaded) {
        this.markUploaded(index);
      }

      if (this.isFinished()) {
        await this.runMerge();
        return;
      }

      this.setPhase('uploading');
      await this.uploadPending();
      if (this.stopped) {
        return;
      }
      await this.runMerge();
    } catch (error) {
      if (this.stopped) {
        return;
      }
      this.fail(error);
    }
  }

  /** 暂停：中断在途请求，已收分片保留（恢复时靠 status 续传）。 */
  pause(): void {
    if (this.state.phase !== 'uploading') {
      return;
    }
    this.stopped = true;
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.setPhase('paused');
  }

  /** 恢复：重新查询状态并继续上传。 */
  async resume(): Promise<void> {
    if (this.state.phase !== 'paused') {
      return;
    }
    this.stopped = false;
    await this.start();
  }

  /** 取消：中断请求并清理服务端分片。 */
  async cancel(): Promise<void> {
    this.stopped = true;
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    if (this.state.identifier) {
      await this.deps.cancel(this.state.identifier).catch(() => undefined);
    }
    this.state.uploadedChunks = 0;
    this.state.uploadedBytes = 0;
    this.setPhase('canceled');
  }

  /** 全部目标分片是否已收齐。 */
  private isFinished(): boolean {
    return this.state.uploadedChunks >= this.state.totalChunks;
  }

  /** 并发上传未完成的分片（工作池模式）。 */
  private async uploadPending(): Promise<void> {
    const pending = this.chunks.filter((chunk) => !this.isChunkUploaded(chunk.index));
    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.deps.concurrency; i += 1) {
      workers.push(
        (async () => {
          // 逐个领取任务（闭包共享索引游标），比预分配更均匀
          while (!this.stopped) {
            const next = pending.shift();
            if (!next) {
              return;
            }
            await this.uploadWithRetry(next);
            if (this.stopped) {
              return;
            }
          }
        })(),
      );
    }
    await Promise.all(workers);
  }

  /** 单分片上传 + 失败重试（最后一次失败抛出，由 start 收敛为 error 相位）。 */
  private async uploadWithRetry(chunk: FileChunk): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.deps.retries; attempt += 1) {
      if (this.stopped) {
        return;
      }
      const controller = new AbortController();
      this.abortControllers.add(controller);
      try {
        await this.deps.uploadChunk({
          file: chunk.blob,
          identifier: this.state.identifier,
          chunkIndex: chunk.index,
          totalChunks: this.state.totalChunks,
          filename: this.state.file.name,
          totalSize: this.state.file.size,
          signal: controller.signal,
        });
        this.markUploaded(chunk.index);
        return;
      } catch (error) {
        lastError = error;
      } finally {
        this.abortControllers.delete(controller);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** 合并 → 完成（秒传命中由服务端判定并返回既有记录）。 */
  private async runMerge(): Promise<void> {
    this.setPhase('merging');
    const item = await this.deps.merge({
      identifier: this.state.identifier,
      totalChunks: this.state.totalChunks,
      filename: this.state.file.name,
      totalSize: this.state.file.size,
      mimeType: this.state.file.type || undefined,
    });
    this.setPhase('done');
    this.deps.onDone?.(item);
  }

  /** 标记某片已传（以「序号集合」判断，重复响应天然幂等）。 */
  private markUploaded(index: number): void {
    this.marked.add(index);
    this.state.uploadedChunks = this.marked.size;
    this.state.uploadedBytes = this.chunks
      .filter((chunk) => this.marked.has(chunk.index))
      .reduce((sum, chunk) => sum + chunk.size, 0);
    this.deps.onState?.({ ...this.state });
  }

  private isChunkUploaded(index: number): boolean {
    return this.marked.has(index);
  }

  private setPhase(phase: ChunkUploadPhase): void {
    this.state.phase = phase;
    this.deps.onState?.({ ...this.state });
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.state.error = message;
    this.setPhase('error');
    this.deps.onError?.(message);
  }
}
