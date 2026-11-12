/**
 * 文件接口：上传、列表、下载与删除，以及类型 / 上传人筛选项和秒传预检。
 */
import type { AxiosResponse } from 'axios';
import { del, get, request, service } from './request';
import type { FileItem, FileQuota, FileQuery, FileUploaderOption, PageResult } from '@/types/api';

/**
 * 上传文件（支持 1~10 个）。
 * @param files 文件列表
 * @param biz 可选业务归属（如 { bizType: 'notice', bizId: 12 }），便于日后按业务反查附件
 */
export function uploadFilesApi(files: File[], biz?: { bizType?: string; bizId?: number }): Promise<FileItem[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (biz?.bizType) {
    formData.append('bizType', biz.bizType);
  }
  if (biz?.bizId !== undefined) {
    formData.append('bizId', String(biz.bizId));
  }
  return request<FileItem[]>({
    url: '/files/upload',
    method: 'POST',
    data: formData,
  });
}

/** 当前用户的上传配额使用情况 */
export function getFileQuotaApi(): Promise<FileQuota> {
  return get<FileQuota>('/files/quota');
}

/** 文件列表（P2） */
export function getFileListApi(params: FileQuery): Promise<PageResult<FileItem>> {
  return get<PageResult<FileItem>>('/files', params);
}

/** 删除文件（P2） */
export function deleteFileApi(id: number): Promise<null> {
  return del<null>(`/files/${id}`);
}

/** 文件类型选项：对库内 mimeType 去重，库里新增类型后下拉自动同步 */
export function getFileTypesApi(): Promise<string[]> {
  return get<string[]>('/files/types');
}

/** 上传人选项：对库内 uploader_id 去重并关联用户表 */
export function getFileUploadersApi(): Promise<FileUploaderOption[]> {
  return get<FileUploaderOption[]>('/files/uploaders');
}

/** 下载文件（二进制流，前端用 downloadBlob 落盘） */
export function downloadFileApi(id: number): Promise<Blob> {
  return request<Blob>({
    url: `/files/${id}/download`,
    method: 'GET',
    responseType: 'blob',
  });
}

/** 秒传预检：按内容哈希查询库内是否已存在相同文件 */
export function checkFileApi(hash: string): Promise<{ exists: boolean; file: FileItem | null }> {
  return get<{ exists: boolean; file: FileItem | null }>('/files/check', { hash });
}

/* ------------------------------ 分片上传（大文件） ------------------------------ */

/** 上传单个分片（multipart：文件字段 `file` + 元信息字段）。 */
export function uploadChunkApi(
  input: {
    file: Blob;
    identifier: string;
    chunkIndex: number;
    totalChunks: number;
    filename: string;
    totalSize: number;
  },
  signal?: AbortSignal,
): Promise<{ received: number; uploaded: number[] }> {
  const formData = new FormData();
  formData.append('file', input.file, 'blob');
  formData.append('identifier', input.identifier);
  formData.append('chunkIndex', String(input.chunkIndex));
  formData.append('totalChunks', String(input.totalChunks));
  formData.append('filename', input.filename);
  formData.append('totalSize', String(input.totalSize));
  return request<{ received: number; uploaded: number[] }>({
    url: '/files/chunk',
    method: 'POST',
    data: formData,
    signal,
  });
}

/** 分片状态：已上传的序号列表（断点续传的依据；标识从未用过返回空数组）。 */
export function chunkStatusApi(identifier: string): Promise<{ uploaded: number[] }> {
  return get<{ uploaded: number[] }>('/files/chunk/status', { identifier });
}

/** 合并分片：拼合 → 大小核对 → 流式哈希 → 秒传去重 → 落库。 */
export function mergeChunksApi(input: {
  identifier: string;
  totalChunks: number;
  filename: string;
  totalSize: number;
  mimeType?: string;
  bizType?: string;
  bizId?: number;
}): Promise<FileItem> {
  return request<FileItem>({ url: '/files/chunk/merge', method: 'POST', data: input });
}

/** 取消上传：清理该标识的全部分片。 */
export function cancelChunksApi(identifier: string): Promise<null> {
  return del<null>(`/files/chunk?identifier=${encodeURIComponent(identifier)}`);
}

/**
 * Range 下载（分片下载 / 断点续传）。
 *
 * 直接用导出的 axios 实例（绕开 request 包装）：这里需要的是**完整响应**
 * （状态码 206/416、Content-Range 头），包装层只回业务数据不够用。
 * @param id 文件 id
 * @param range Range 头，如 `bytes=1048576-2097151`
 */
export function downloadFileRangeApi(id: number, range: string): Promise<AxiosResponse<Blob>> {
  return service.request<Blob>({
    url: `/files/${id}/download`,
    method: 'GET',
    responseType: 'blob',
    headers: { Range: range },
  });
}
