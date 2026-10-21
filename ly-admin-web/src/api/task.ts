/**
 * 定时任务接口：任务列表、执行记录查询与手动触发。
 */
import { get, post } from './request';
import type { PageResult, TaskItem, TaskLogItem, TaskLogQuery, TaskRunResult } from '@/types/api';

/** 定时任务列表（含调度状态与上次执行摘要） */
export function getTaskListApi(): Promise<TaskItem[]> {
  return get<TaskItem[]>('/tasks');
}

/** 某任务的执行记录（分页） */
export function getTaskLogsApi(name: string, params: TaskLogQuery): Promise<PageResult<TaskLogItem>> {
  return get<PageResult<TaskLogItem>>(`/tasks/${name}/logs`, params);
}

/** 手动触发任务（同步等待执行结果） */
export function runTaskApi(name: string): Promise<TaskRunResult> {
  return post<TaskRunResult>(`/tasks/${name}/run`);
}
