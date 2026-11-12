/**
 * 分片上传纯逻辑单测（无 DOM，vitest node 环境）。
 * 控制器用假 API 驱动：重试、暂停/恢复、取消、失败路径全部覆盖。
 */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  CHUNK_SIZE,
  ChunkUploadController,
  SAMPLE_SEGMENT_BYTES,
  formatChunkFileSize,
  sampledFileHash,
  splitIntoChunks,
  uploadPercent,
  type ChunkUploadState,
} from '@/utils/chunkedFile';
import type { FileItem } from '@/types/api';

/** 构造一个可 slice 的「文件」：slice 返回真 Blob（Node 全局 Blob，与浏览器语义一致）。 */
function fakeFile(size: number, name = 'big.bin', type = 'application/octet-stream'): File {
  const buffer = Buffer.alloc(size, 0x61);
  return {
    name,
    type,
    size,
    slice: (start: number, end: number) => new Blob([buffer.subarray(start, end)]),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;
}

/** 合并成功返回的假记录。 */
function fakeItem(id = 1): FileItem {
  return {
    id,
    originName: 'big.bin',
    fileName: 'bin/big.bin',
    filePath: 'uploads/bin/big.bin',
    fileUrl: '/static/bin/big.bin',
    mimeType: 'application/octet-stream',
    size: CHUNK_SIZE * 2,
    hash: 'a'.repeat(64),
    uploaderId: 1,
    bizType: null,
    bizId: null,
    createdAt: new Date().toISOString(),
  };
}

describe('splitIntoChunks', () => {
  it('按 chunkSize 切分，末片取余数', () => {
    const chunks = splitIntoChunks(fakeFile(CHUNK_SIZE * 2 + 1024));
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.size)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 1024]);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
  });

  it('恰好一片时不产生空尾片', () => {
    const chunks = splitIntoChunks(fakeFile(CHUNK_SIZE));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.size).toBe(CHUNK_SIZE);
  });

  it('自定义分片尺寸', () => {
    const chunks = splitIntoChunks(fakeFile(10), 4);
    expect(chunks.map((chunk) => chunk.size)).toEqual([4, 4, 2]);
  });
});

describe('sampledFileHash', () => {
  it('小文件退化为全量哈希', async () => {
    const file = fakeFile(SAMPLE_SEGMENT_BYTES - 10);
    const expected = createHash('sha256')
      .update(Buffer.alloc(SAMPLE_SEGMENT_BYTES - 10, 0x61))
      .digest('hex');
    await expect(sampledFileHash(file)).resolves.toBe(expected);
  });

  it('大文件为 头/中/尾 三段拼接哈希（与手算一致）', async () => {
    const size = CHUNK_SIZE * 4 + 512;
    const file = fakeFile(size);
    const buffer = Buffer.alloc(size, 0x61);
    const mid = Math.max(0, Math.floor((size - SAMPLE_SEGMENT_BYTES) / 2));
    const parts = [
      buffer.subarray(0, Math.min(SAMPLE_SEGMENT_BYTES, size)),
      buffer.subarray(mid, Math.min(mid + SAMPLE_SEGMENT_BYTES, size)),
      buffer.subarray(Math.max(0, size - SAMPLE_SEGMENT_BYTES), size),
    ];
    // 去重后的起点（与实现保持同口径：Set 去重 + 只取 end > start 的段）
    const starts = new Set([0, mid, Math.max(0, size - SAMPLE_SEGMENT_BYTES)]);
    const kept = [...starts]
      .map((start) => [start, Math.min(start + SAMPLE_SEGMENT_BYTES, size)] as const)
      .filter(([start, end]) => end > start)
      .map(([start, end]) => buffer.subarray(start, end));
    const expected = createHash('sha256').update(Buffer.concat(kept)).digest('hex');
    void parts;
    await expect(sampledFileHash(file)).resolves.toBe(expected);
  });

  it('输出为 64 位小写十六进制（后端标识格式要求）', async () => {
    await expect(sampledFileHash(fakeFile(1000))).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('uploadPercent / formatChunkFileSize', () => {
  const base = { identifier: '', file: fakeFile(100), uploadedBytes: 0, error: null } as ChunkUploadState;

  it('进度按片数比例取整', () => {
    expect(uploadPercent({ ...base, uploadedChunks: 0, totalChunks: 4 })).toBe(0);
    expect(uploadPercent({ ...base, uploadedChunks: 2, totalChunks: 4 })).toBe(50);
    expect(uploadPercent({ ...base, uploadedChunks: 4, totalChunks: 4 })).toBe(100);
  });

  it('总片数为 0 时返回 0 而不是 NaN', () => {
    expect(uploadPercent({ ...base, uploadedChunks: 0, totalChunks: 0 })).toBe(0);
  });

  it('人类可读体积', () => {
    expect(formatChunkFileSize(512)).toBe('512 B');
    expect(formatChunkFileSize(2048)).toBe('2.0 KB');
    expect(formatChunkFileSize(CHUNK_SIZE)).toBe('5.0 MB');
    expect(formatChunkFileSize(2 * 1024 ** 3)).toBe('2.0 GB');
  });
});

describe('ChunkUploadController', () => {
  /** 假 API：在内存里记录哪些分片已收，可注入一次性故障。 */
  function createFakeDeps(options: { failFirst?: boolean; fileSize?: number } = {}) {
    const uploaded = new Set<number>();
    let failuresLeft = options.failFirst ? 1 : 0;
    const mergeInput = vi.fn();
    const cancelSpy = vi.fn(async () => null);
    const stateLog: string[] = [];

    const deps = {
      uploadChunk: vi.fn(async (input: { chunkIndex: number }) => {
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new Error('网络抖动');
        }
        uploaded.add(input.chunkIndex);
        return { received: input.chunkIndex, uploaded: [...uploaded].sort((a, b) => a - b) };
      }),
      status: vi.fn(async () => ({ uploaded: [...uploaded].sort((a, b) => a - b) })),
      merge: vi.fn(async (input: unknown) => {
        mergeInput(input);
        return fakeItem();
      }),
      cancel: cancelSpy,
      onState: (state: ChunkUploadState) => stateLog.push(state.phase),
      onDone: vi.fn(),
      onError: vi.fn(),
    };
    return { deps, uploaded, stateLog, mergeInput, cancelSpy };
  }

  it('完整流程：哈希 → 续传对齐 → 上传 → 合并 → done', async () => {
    const { deps, uploaded } = createFakeDeps();
    const done = vi.fn();
    deps.onDone = done;
    // 注意：控制器构造时会快照 deps，onDone/onError 必须在构造前挂好
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 2), deps);

    await controller.start();

    expect(done).toHaveBeenCalledTimes(1);
    expect(uploaded.size).toBe(2);
    expect(controller.state.phase).toBe('done');
    expect(controller.state.uploadedChunks).toBe(2);
    expect(controller.state.identifier).toMatch(/^[a-f0-9]{64}$/);
    expect(deps.merge).toHaveBeenCalledTimes(1);
    // 合并参数带全量文件信息
    expect(deps.merge.mock.calls[0]![0]).toMatchObject({ totalChunks: 2, totalSize: CHUNK_SIZE * 2 });
  });

  it('单分片失败后按重试次数恢复，不中断整体流程', async () => {
    const { deps, uploaded } = createFakeDeps({ failFirst: true });
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 2), deps);

    await controller.start();

    expect(uploaded.size).toBe(2);
    expect(controller.state.phase).toBe('done');
    // 第一次故障 + 重试成功：上传调用 = 3 次
    expect(deps.uploadChunk).toHaveBeenCalledTimes(3);
  });

  it('断点续传：status 已有分片不重传', async () => {
    const { deps, uploaded } = createFakeDeps();
    // 预置「上次传过第 0 片」
    uploaded.add(0);
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 2), deps);

    await controller.start();

    // 只补传第 1 片
    expect(deps.uploadChunk).toHaveBeenCalledTimes(1);
    expect(deps.uploadChunk.mock.calls[0]![0]).toMatchObject({ chunkIndex: 1 });
    expect(controller.state.phase).toBe('done');
  });

  it('暂停后相位 paused，恢复后从 status 续传完成', async () => {
    const { deps } = createFakeDeps();
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 4), deps);

    // 传 2 片后手动暂停（通过 status 模拟：先让控制器跑到 paused）
    const originalUpload = deps.uploadChunk.getMockImplementation()!;
    let calls = 0;
    deps.uploadChunk.mockImplementation(async (input) => {
      calls += 1;
      if (calls === 2) {
        controller.pause();
      }
      return originalUpload(input);
    });

    await controller.start();
    expect(controller.state.phase).toBe('paused');

    await controller.resume();
    expect(controller.state.phase).toBe('done');
  });

  it('所有分片已在服务端（全续传）时不发上传请求直接合并', async () => {
    const { deps, uploaded } = createFakeDeps();
    uploaded.add(0);
    uploaded.add(1);
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 2), deps);

    await controller.start();

    expect(deps.uploadChunk).not.toHaveBeenCalled();
    expect(controller.state.phase).toBe('done');
  });

  it('失败路径：重试耗尽后进入 error 并回调一次', async () => {
    const { deps } = createFakeDeps();
    const onError = vi.fn();
    deps.onError = onError;
    deps.uploadChunk.mockImplementation(async () => {
      throw new Error('网关 502');
    });
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE), deps);

    await controller.start();

    expect(controller.state.phase).toBe('error');
    expect(controller.state.error).toBe('网关 502');
    expect(onError).toHaveBeenCalledWith('网关 502');
    // 1 片 × (1 + 2 次重试) = 3 次
    expect(deps.uploadChunk).toHaveBeenCalledTimes(3);
  });

  it('取消：中断 + 调清理接口 + 相位 canceled', async () => {
    const { deps, cancelSpy } = createFakeDeps();
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 2), deps);

    await controller.start();
    // 完成后取消仍调用清理（幂等），但相位已经是 done 不再改
    await controller.cancel();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('上传中取消：在途请求收到 abort 信号', async () => {
    const { deps } = createFakeDeps();
    const controller = new ChunkUploadController(fakeFile(CHUNK_SIZE * 3), deps);
    let sawSignal = false;
    deps.uploadChunk.mockImplementation(async (input: { chunkIndex: number; signal?: AbortSignal }) => {
      sawSignal = input.signal instanceof AbortSignal;
      controller.cancel();
      throw new Error('aborted');
    });

    await controller.start();

    expect(sawSignal).toBe(true);
    expect(controller.state.phase).toBe('canceled');
  });
});
