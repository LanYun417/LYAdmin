import { del, get, post, put } from './request';
import type { DeptNode, DeptQuery, DeptUpsert } from '@/types/api';

/** 部门列表（tree=1 时返回树） */
export function getDeptListApi(params?: DeptQuery): Promise<DeptNode[]> {
  return get<DeptNode[]>('/depts', params);
}

/** 部门树（上级选择） */
export function getDeptTreeApi(): Promise<DeptNode[]> {
  return get<DeptNode[]>('/depts/tree');
}

/** 部门详情 */
export function getDeptDetailApi(id: number): Promise<DeptNode> {
  return get<DeptNode>(`/depts/${id}`);
}

/** 新增部门 */
export function createDeptApi(data: DeptUpsert): Promise<DeptNode> {
  return post<DeptNode>('/depts', data);
}

/** 编辑部门 */
export function updateDeptApi(id: number, data: DeptUpsert): Promise<DeptNode> {
  return put<DeptNode>(`/depts/${id}`, data);
}

/** 删除部门 */
export function deleteDeptApi(id: number): Promise<null> {
  return del<null>(`/depts/${id}`);
}
