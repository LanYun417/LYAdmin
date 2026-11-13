/**
 * 导出中心（异步导出）接口。
 */
import { get, post, del, request } from './request';
import { downloadBlob } from '@/utils/download';
import type { ExportTaskItem, PageResult } from '@/types/api';

/** 导出模块（与后端白名单一致）。 */
export type ExportModuleKey = 'login-log' | 'operation-log' | 'http-log';

/** 创建导出任务：module + 列表页当前筛选条件快照。 */
export function createExportTaskApi(input: {
  module: ExportModuleKey;
  query?: Record<string, unknown>;
  timezoneOffset?: number;
}): Promise<{ id: number; moduleLabel: string }> {
  return post<{ id: number; moduleLabel: string }>('/export-tasks', input);
}

/** 我的导出任务（分页）。 */
export function getExportTasksApi(params: {
  page?: number;
  pageSize?: number;
  module?: string;
}): Promise<PageResult<ExportTaskItem>> {
  return get<PageResult<ExportTaskItem>>('/export-tasks', params);
}

/** 删除导出任务（记录与文件一并删除）。 */
export function deleteExportTaskApi(id: number): Promise<null> {
  return del<null>(`/export-tasks/${id}`);
}

/**
 * 下载导出任务文件。
 *
 * 不能用 `<a href>` 裸跳：接口带鉴权（Bearer 头），浏览器直连拿不到 token 会 401。
 * 走 axios 拉 Blob 再由前端落盘（与文件列表下载同思路）。
 * @param id 任务 id
 * @param filename 落盘文件名（用任务的 fileName）
 */
export function downloadExportTaskApi(id: number, filename: string): Promise<void> {
  return request<Blob>({
    url: `/export-tasks/${id}/download`,
    method: 'GET',
    responseType: 'blob',
  }).then((blob) => {
    downloadBlob(blob as Blob, filename);
  });
}
