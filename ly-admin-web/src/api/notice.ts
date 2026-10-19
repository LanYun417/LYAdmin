/**
 * 站内通知接口：收件箱、未读数、已读与发布。
 */
import { del, get, post, put } from './request';
import type { NoticeItem, NoticePublishPayload, NoticeQuery, PageResult } from '@/types/api';

/** 我的收件箱（未读优先 + 时间倒序） */
export function getNoticeListApi(params: NoticeQuery): Promise<PageResult<NoticeItem>> {
  return get<PageResult<NoticeItem>>('/notices', params);
}

/** 未读数（顶栏红点） */
export function getNoticeUnreadCountApi(): Promise<{ count: number }> {
  return get<{ count: number }>('/notices/unread-count');
}

/** 标记单条已读 */
export function markNoticeReadApi(id: number): Promise<null> {
  return put<null>(`/notices/${id}/read`);
}

/** 全部标记已读 */
export function markAllNoticesReadApi(): Promise<{ count: number }> {
  return put<{ count: number }>('/notices/read-all');
}

/** 删除一条通知 */
export function deleteNoticeApi(id: number): Promise<null> {
  return del<null>(`/notices/${id}`);
}

/** 清空我的通知 */
export function clearNoticesApi(): Promise<{ count: number }> {
  return del<{ count: number }>('/notices');
}

/** 发布通知（指定人或全员） */
export function publishNoticeApi(payload: NoticePublishPayload): Promise<{ count: number }> {
  return post<{ count: number }>('/notices', payload);
}
