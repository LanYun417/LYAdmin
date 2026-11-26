/**
 * 数据导入接口：类型列表、上传入队、记录查询。
 * 导入为异步执行，上传只返回受理信息。
 */
import { get, post } from './request';
import type { ImportRecord } from '@/types/api';

/** 已注册的导入类型 */
export function listImportTypesApi(): Promise<Array<{ type: string; title: string }>> {
  return get<Array<{ type: string; title: string }>>('/import/types');
}

/** 上传并入队（FormData: file；type 走 query） */
export function submitImportApi(type: string, file: File): Promise<{ jobId: number; fileName: string }> {
  const form = new FormData();
  form.append('file', file);
  return post<{ jobId: number; fileName: string }>(`/import/submit?type=${encodeURIComponent(type)}`, form);
}

/** 导入记录分页 */
export function listImportRecordsApi(params?: {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
}): Promise<{ list: ImportRecord[]; total: number }> {
  return get<{ list: ImportRecord[]; total: number }>('/import/records', params);
}
