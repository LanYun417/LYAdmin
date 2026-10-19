/**
 * 监控接口：系统资源快照与在线会话管理。
 */
import { del, get } from './request';
import type { OnlineQuery, OnlineSession, PageResult, ServerMetrics } from '@/types/api';

/** 在线会话列表 */
export function getOnlineSessionsApi(params: OnlineQuery): Promise<PageResult<OnlineSession>> {
  return get<PageResult<OnlineSession>>('/monitor/online', params);
}

/** 强制下线单个会话（该会话的令牌随即失效） */
export function forceLogoutSessionApi(sid: string): Promise<null> {
  return del<null>(`/monitor/online/${sid}`);
}

/** 强制下线某用户的全部会话 */
export function forceLogoutUserApi(userId: number): Promise<null> {
  return del<null>(`/monitor/online/user/${userId}`);
}

/** 系统资源快照（后端每 3s 采样一次，这里只取最近一次，不是每次请求都重新采样） */
export function getServerMetricsApi(): Promise<ServerMetrics> {
  return get<ServerMetrics>('/monitor/server');
}
