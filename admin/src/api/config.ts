import { del, get, post, put } from './request';
import type { ConfigData, ConfigQuery, ConfigUpsert, PageResult, SysConfigItem } from '@/types/api';

/** 参数分页列表 */
export function getConfigListApi(params: ConfigQuery): Promise<PageResult<SysConfigItem>> {
  return get<PageResult<SysConfigItem>>('/configs', params);
}

/** 按键取参数值（业务取数，仅需登录） */
export function getConfigDataApi(configKey: string): Promise<ConfigData | null> {
  return get<ConfigData | null>(`/configs/data/${encodeURIComponent(configKey)}`);
}

/** 参数详情 */
export function getConfigDetailApi(id: number): Promise<SysConfigItem> {
  return get<SysConfigItem>(`/configs/${id}`);
}

/** 新增参数 */
export function createConfigApi(data: ConfigUpsert): Promise<SysConfigItem> {
  return post<SysConfigItem>('/configs', data);
}

/** 编辑参数（键名不可改） */
export function updateConfigApi(id: number, data: Partial<ConfigUpsert>): Promise<SysConfigItem> {
  return put<SysConfigItem>(`/configs/${id}`, data);
}

/** 删除参数 */
export function deleteConfigApi(id: number): Promise<null> {
  return del<null>(`/configs/${id}`);
}
