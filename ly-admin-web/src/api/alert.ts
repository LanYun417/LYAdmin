/**
 * 告警中心接口：渠道 / 规则配置管理、测试发送、投递记录查询与重试。
 * 渠道的敏感字段（SMTP 口令 / 加签密钥）只写不读：后端永不明文下发，
 * 更新时留空表示不修改。
 */
import { del, get, post, put } from './request';
import type { AlertChannel, AlertRecord, AlertRule } from '@/types/api';

/** 渠道列表（敏感字段脱敏） */
export function listAlertChannelsApi(): Promise<AlertChannel[]> {
  return get<AlertChannel[]>('/alert/channels');
}

/** 渠道详情（编辑回显用；敏感字段为 '***' 占位） */
export function getAlertChannelConfig(id: number): Promise<AlertChannel> {
  return get<AlertChannel>(`/alert/channels/${id}`);
}

/** 新增渠道 */
export function createAlertChannelApi(data: Partial<AlertChannel>): Promise<AlertChannel> {
  return post<AlertChannel>('/alert/channels', data);
}

/** 更新渠道（敏感字段留空 = 不修改） */
export function updateAlertChannelApi(id: number, data: Partial<AlertChannel>): Promise<AlertChannel> {
  return put<AlertChannel>(`/alert/channels/${id}`, data);
}

/** 删除渠道 */
export function deleteAlertChannelApi(id: number): Promise<null> {
  return del<null>(`/alert/channels/${id}`);
}

/** 测试发送（立即向该渠道投一条测试告警并落库） */
export function testAlertChannelApi(id: number): Promise<AlertRecord> {
  return post<AlertRecord>(`/alert/channels/${id}/test`);
}

/** 规则列表 */
export function listAlertRulesApi(): Promise<AlertRule[]> {
  return get<AlertRule[]>('/alert/rules');
}

/** 新增规则 */
export function createAlertRuleApi(data: Partial<AlertRule>): Promise<AlertRule> {
  return post<AlertRule>('/alert/rules', data);
}

/** 更新规则 */
export function updateAlertRuleApi(id: number, data: Partial<AlertRule>): Promise<AlertRule> {
  return put<AlertRule>(`/alert/rules/${id}`, data);
}

/** 删除规则 */
export function deleteAlertRuleApi(id: number): Promise<null> {
  return del<null>(`/alert/rules/${id}`);
}

/** 投递记录分页 */
export function listAlertRecordsApi(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  eventType?: string;
}): Promise<{ list: AlertRecord[]; total: number }> {
  return get<{ list: AlertRecord[]; total: number }>('/alert/records', params);
}

/** 重投一条失败记录（原渠道集合） */
export function retryAlertRecordApi(id: number): Promise<AlertRecord> {
  return post<AlertRecord>(`/alert/records/${id}/retry`);
}
