/**
 * 字典接口：字典类型与字典项的增删改查、状态切换，以及业务侧按类型取数。
 */
import { del, get, post, put } from './request';
import type {
  DictDataItem,
  DictItem,
  DictItemQuery,
  DictItemUpsert,
  DictType,
  DictTypeQuery,
  DictTypeUpsert,
  PageResult,
} from '@/types/api';

/* ------------------------------ 字典类型 ------------------------------ */

/** 字典类型分页列表 */
export function getDictTypeListApi(params: DictTypeQuery): Promise<PageResult<DictType>> {
  return get<PageResult<DictType>>('/dict/types', params);
}

/** 新增字典类型 */
export function createDictTypeApi(data: DictTypeUpsert): Promise<DictType> {
  return post<DictType>('/dict/types', data);
}

/** 编辑字典类型（不可修改类型编码） */
export function updateDictTypeApi(id: number, data: Omit<DictTypeUpsert, 'dictType'>): Promise<DictType> {
  return put<DictType>(`/dict/types/${id}`, data);
}

/** 启用 / 禁用字典类型 */
export function setDictTypeStatusApi(id: number, status: number): Promise<DictType> {
  return put<DictType>(`/dict/types/${id}/status`, { status });
}

/** 删除字典类型（连带删除其下字典项） */
export function deleteDictTypeApi(id: number): Promise<null> {
  return del<null>(`/dict/types/${id}`);
}

/* ------------------------------ 字典项 ------------------------------ */

/** 字典项分页列表（dictType 必填） */
export function getDictItemListApi(params: DictItemQuery): Promise<PageResult<DictItem>> {
  return get<PageResult<DictItem>>('/dict/items', params);
}

/** 新增字典项 */
export function createDictItemApi(data: DictItemUpsert): Promise<DictItem> {
  return post<DictItem>('/dict/items', data);
}

/** 编辑字典项（不可修改所属类型） */
export function updateDictItemApi(id: number, data: Omit<DictItemUpsert, 'dictType'>): Promise<DictItem> {
  return put<DictItem>(`/dict/items/${id}`, data);
}

/** 启用 / 禁用字典项 */
export function setDictItemStatusApi(id: number, status: number): Promise<DictItem> {
  return put<DictItem>(`/dict/items/${id}/status`, { status });
}

/** 删除字典项 */
export function deleteDictItemApi(id: number): Promise<null> {
  return del<null>(`/dict/items/${id}`);
}

/* ------------------------------ 业务取数 ------------------------------ */

/** 按类型编码取启用中的字典数据（业务侧渲染下拉 / 标签用） */
export function getDictDataApi(dictType: string): Promise<DictDataItem[]> {
  return get<DictDataItem[]>(`/dict/data/${dictType}`);
}
