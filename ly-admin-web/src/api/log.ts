/**
 * 日志接口：登录日志、操作日志与 HTTP 访问日志的查询、清空与 CSV 导出。
 */
import { del, get, request } from './request';
import type {
  HttpLog,
  HttpLogQuery,
  LoginLog,
  LoginLogQuery,
  OperationLog,
  OperationLogQuery,
  PageResult,
} from '@/types/api';

/** 登录日志列表 */
export function getLoginLogsApi(params: LoginLogQuery): Promise<PageResult<LoginLog>> {
  return get<PageResult<LoginLog>>('/logs/login', params);
}

/** 操作日志列表 */
export function getOperationLogsApi(params: OperationLogQuery): Promise<PageResult<OperationLog>> {
  return get<PageResult<OperationLog>>('/logs/operation', params);
}

/** HTTP 访问日志列表 */
export function getHttpLogsApi(params: HttpLogQuery): Promise<PageResult<HttpLog>> {
  return get<PageResult<HttpLog>>('/logs/http', params);
}

/** HTTP 访问日志详情（请求 / 响应体按需加载） */
export function getHttpLogDetailApi(id: number): Promise<HttpLog> {
  return get<HttpLog>(`/logs/http/detail/${id}`);
}

/** 清空所有 HTTP 访问日志 */
export function clearHttpLogsApi(): Promise<null> {
  return del<null>('/logs/http');
}

/** 删除单条登录日志 */
export function deleteLoginLogApi(id: number): Promise<null> {
  return del<null>(`/logs/login/${id}`);
}

/** 批量删除登录日志（多选） */
export function deleteLoginLogsApi(ids: number[]): Promise<null> {
  return request<null>({ url: '/logs/login/batch', method: 'DELETE', data: { ids } });
}

/** 删除单条操作日志 */
export function deleteOperationLogApi(id: number): Promise<null> {
  return del<null>(`/logs/operation/${id}`);
}

/** 批量删除操作日志（多选） */
export function deleteOperationLogsApi(ids: number[]): Promise<null> {
  return request<null>({ url: '/logs/operation/batch', method: 'DELETE', data: { ids } });
}

/** 删除单条 HTTP 访问日志 */
export function deleteHttpLogApi(id: number): Promise<null> {
  return del<null>(`/logs/http/${id}`);
}

/** 批量删除 HTTP 访问日志（多选） */
export function deleteHttpLogsApi(ids: number[]): Promise<null> {
  return request<null>({ url: '/logs/http/batch', method: 'DELETE', data: { ids } });
}

/** 导出 HTTP 访问日志（CSV） */
export function exportHttpLogsApi(params: Omit<HttpLogQuery, 'page' | 'pageSize'>): Promise<Blob> {
  return request<Blob>({
    url: '/logs/http/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/** 导出登录日志（CSV，P2） */
export function exportLoginLogsApi(params: Omit<LoginLogQuery, 'page' | 'pageSize'>): Promise<Blob> {
  return request<Blob>({
    url: '/logs/login/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}

/** 导出操作日志（CSV，P2） */
export function exportOperationLogsApi(params: Omit<OperationLogQuery, 'page' | 'pageSize'>): Promise<Blob> {
  return request<Blob>({
    url: '/logs/operation/export',
    method: 'GET',
    params,
    responseType: 'blob',
  });
}
