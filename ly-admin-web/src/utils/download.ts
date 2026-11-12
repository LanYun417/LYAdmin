/**
 * 浏览器端文件下载工具。
 */
import { downloadFileApi, downloadFileRangeApi } from '@/api/file';

/**
 * 触发浏览器下载一个 Blob。
 *
 * 实现方式：基于 Blob 创建临时对象 URL，挂到隐藏的临时 `<a>` 上并触发点击，
 * 下载触发后立即移除 `<a>` 并调用 `URL.revokeObjectURL` 释放对象 URL，
 * 避免内存泄漏（对象 URL 会一直占用内存直到被显式释放）。
 *
 * @param blob 待下载的二进制内容
 * @param filename 下载文件名（建议包含扩展名）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 延迟释放对象 URL：若在 click() 后立即 revoke，部分浏览器会判定下载被取消
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 分片（Range）下载：探测总大小 → 分段拉取（失败可重试同段）→ Blob 组装落盘。
 *
 * 说明：
 * - 服务端下载基于 Express `res.download`（send 库），原生支持 Range，
 *   e2e 已验证 206 + Content-Range（见 files-chunk.e2e-spec.ts）；
 * - 每段失败自动重试同一区间（断点续传语义），重试耗尽才整体报错；
 * - 全程内存中等价于一份文件大小：超 1GB 会有内存压力，此时仍按分段拉取
 *   （承载鉴权是 Bearer 头，浏览器直连/右键另存无法带上），进度条会如实反映；
 * - 服务端不支持 Range 时（200 全量响应）自动退化为整包拉取。
 *
 * @param id 文件 id
 * @param filename 落盘文件名
 * @param options.partSize 分段大小（默认 8MB）
 * @param options.onProgress 进度回调（已加载字节 / 总字节）
 * @param options.signal 外部中断信号
 */
export async function downloadFileResumable(
  id: number,
  filename: string,
  options: {
    partSize?: number;
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const partSize = options.partSize ?? 8 * 1024 * 1024;

  // 探测总大小：只取 1 字节，服务端回 206 + Content-Range: bytes 0-0/<total>
  const probe = await downloadFileRangeApi(id, 'bytes=0-0');
  const contentRange = String(probe.headers['content-range'] ?? '');
  const totalMatched = /bytes \d+-\d+\/(\d+)/.exec(contentRange);
  if (probe.status !== 206 || !totalMatched) {
    // 不支持 Range：整包兜底
    const blob = await downloadFileApi(id);
    downloadBlob(blob, filename);
    return;
  }

  const total = Number(totalMatched[1]);
  if (!Number.isFinite(total) || total <= 0) {
    const blob = await downloadFileApi(id);
    downloadBlob(blob, filename);
    return;
  }

  const parts: Blob[] = [];
  let loaded = 0;
  for (let start = 0; start < total; start += partSize) {
    let lastError: unknown;
    let part: Blob | null = null;
    // 同段最多重试 2 次（网络中断后从同一区间继续，即「断点续传」）
    for (let attempt = 0; attempt < 3 && !part; attempt += 1) {
      try {
        const end = Math.min(start + partSize, total) - 1;
        const response = await downloadFileRangeApi(id, `bytes=${start}-${end}`);
        if (response.status === 206) {
          part = response.data;
        } else if (response.status === 200) {
          // 服务端对该请求降级为全量：后续没有必要再分段
          downloadBlob(response.data, filename);
          options.onProgress?.(response.data.size, response.data.size);
          return;
        }
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted) {
          throw error;
        }
      }
    }
    if (!part) {
      throw lastError instanceof Error ? lastError : new Error('分片下载失败');
    }
    parts.push(part);
    loaded += part.size;
    options.onProgress?.(loaded, total);
  }

  downloadBlob(new Blob(parts), filename);
}
