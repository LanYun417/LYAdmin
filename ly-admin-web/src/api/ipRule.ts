/**
 * IP 访问控制接口：规则列表 / 新增 / 编辑 / 启停 / 清命中 / 删除。
 */
import { del, get, post, put } from './request';
import type { IpRuleItem, IpRuleQuery, IpRuleUpsert, PageResult } from '@/types/api';

/** 规则分页列表 */
export function getIpRuleListApi(params: IpRuleQuery): Promise<PageResult<IpRuleItem>> {
  return get<PageResult<IpRuleItem>>('/ip-rules', params);
}

/** 规则详情 */
export function getIpRuleDetailApi(id: number): Promise<IpRuleItem> {
  return get<IpRuleItem>(`/ip-rules/${id}`);
}

/** 新增规则 */
export function createIpRuleApi(data: IpRuleUpsert): Promise<IpRuleItem> {
  return post<IpRuleItem>('/ip-rules', data);
}

/** 编辑规则（IP 不可改） */
export function updateIpRuleApi(id: number, data: Omit<IpRuleUpsert, 'ip'>): Promise<IpRuleItem> {
  return put<IpRuleItem>(`/ip-rules/${id}`, data);
}

/** 启停规则 */
export function toggleIpRuleApi(id: number): Promise<IpRuleItem> {
  return put<IpRuleItem>(`/ip-rules/${id}/status`);
}

/** 清空命中计数 */
export function resetIpRuleHitApi(id: number): Promise<null> {
  return put<null>(`/ip-rules/${id}/hit-reset`);
}

/** 删除规则 */
export function deleteIpRuleApi(id: number): Promise<null> {
  return del<null>(`/ip-rules/${id}`);
}
