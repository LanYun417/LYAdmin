/**
 * 在线用户接口：会话列表与强制下线。
 */
import { del, get } from './request';
import type { OnlineQuery, OnlineSession, PageResult } from '@/types/api';

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
