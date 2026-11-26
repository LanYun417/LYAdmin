/**
 * 通用任务队列接口：任务查询、入队、重放、手动消费。
 */
import { get, post, put } from './request';
import type { QueueJob } from '@/types/api';

/** 任务分页列表 */
export function listQueueJobsApi(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}): Promise<{ list: QueueJob[]; total: number }> {
  return get<{ list: QueueJob[]; total: number }>('/queue/jobs', params);
}

/** 入队（幂等键命中时直接返回已有任务） */
export function enqueueJobApi(data: {
  type: string;
  title: string;
  payload: Record<string, unknown>;
  idemKey?: string;
  maxAttempts?: number;
}): Promise<QueueJob> {
  return post<QueueJob>('/queue/jobs', data);
}

/** 重放（dead / done → pending） */
export function replayJobApi(id: number): Promise<QueueJob> {
  return put<QueueJob>(`/queue/jobs/${id}/replay`);
}

/** 手动触发一次消费（运维排障） */
export function consumeQueueApi(): Promise<{ processed: number; succeeded: number; failed: number; dead: number }> {
  return post<{ processed: number; succeeded: number; failed: number; dead: number }>('/queue/consume');
}
