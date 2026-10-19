/**
 * 文件接口：上传、列表、下载与删除，以及类型 / 上传人筛选项和秒传预检。
 */
import { del, get, request } from './request';
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
