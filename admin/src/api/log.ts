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

/** 清空所有 HTTP 访问日志 */
export function clearHttpLogsApi(): Promise<null> {
  return del<null>('/logs/http');
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
