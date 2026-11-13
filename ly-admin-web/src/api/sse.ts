/**
 * SSE 相关接口：主题订阅与在线连接数。
 * 连接本身走浏览器 EventSource（见 utils/sse.ts），不需要接口。
 */
import { get, post } from './request';

/** 订阅 / 退订一个推送主题（当前后端仅支持 metrics）。 */
export function setSseTopicApi(topic: 'metrics', enabled: boolean): Promise<{ topic: string; enabled: boolean }> {
  return post<{ topic: string; enabled: boolean }>('/sse/topics', { topic, enabled });
}

/** 当前在线连接数（健康检查：与本地 SSE 状态对照，可判断是否假死）。 */
export function getSseOnlineCountApi(): Promise<{ onlineUsers: number }> {
  return get<{ onlineUsers: number }>('/sse/online-count');
}
