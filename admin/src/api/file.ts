import { del, get, request } from './request';
import type { FileItem, FileQuery, PageResult } from '@/types/api';

/** 上传文件（支持 1~10 个） */
export function uploadFilesApi(files: File[]): Promise<FileItem[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return request<FileItem[]>({
    url: '/files/upload',
    method: 'POST',
    data: formData,
  });
}

/** 文件列表（P2） */
export function getFileListApi(params: FileQuery): Promise<PageResult<FileItem>> {
  return get<PageResult<FileItem>>('/files', params);
}

/** 删除文件（P2） */
export function deleteFileApi(id: number): Promise<null> {
  return del<null>(`/files/${id}`);
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
