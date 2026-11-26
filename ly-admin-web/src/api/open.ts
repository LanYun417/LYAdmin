/**
 * 开放 API 接口：服务账号密钥（API Key）与 Webhook 订阅。
 *
 * 安全约定：
 * - 密钥明文只在「创建响应」里出现一次，后端任何接口都不再返回；
 * - Webhook 签名密钥只写不读（更新时留空 = 不修改）。
 */
import { del, get, post, put } from './request';
import type { ApiKey, WebhookDelivery, WebhookItem } from '@/types/api';

/* -------------------------------- API Key -------------------------------- */

/** 密钥分页列表 */
export function listApiKeysApi(params?: {
  page?: number;
  pageSize?: number;
  name?: string;
}): Promise<{ list: ApiKey[]; total: number }> {
  return get<{ list: ApiKey[]; total: number }>('/open/keys', params);
}

/** 密钥详情 */
export function getApiKeyApi(id: number): Promise<ApiKey> {
  return get<ApiKey>(`/open/keys/${id}`);
}

/** 签发密钥（响应含一次性明文 key） */
export function createApiKeyApi(data: Partial<ApiKey>): Promise<ApiKey> {
  return post<ApiKey>('/open/keys', data);
}

/** 更新密钥配置（密钥本体不可改） */
export function updateApiKeyApi(id: number, data: Partial<ApiKey>): Promise<ApiKey> {
  return put<ApiKey>(`/open/keys/${id}`, data);
}

/** 启停密钥 */
export function toggleApiKeyApi(id: number): Promise<ApiKey> {
  return put<ApiKey>(`/open/keys/${id}/status`);
}

/** 删除密钥 */
export function deleteApiKeyApi(id: number): Promise<null> {
  return del<null>(`/open/keys/${id}`);
}

/* -------------------------------- Webhook -------------------------------- */

/** 订阅列表 */
export function listWebhooksApi(): Promise<WebhookItem[]> {
  return get<WebhookItem[]>('/open/webhooks');
}

/** 订阅详情 */
export function getWebhookApi(id: number): Promise<WebhookItem> {
  return get<WebhookItem>(`/open/webhooks/${id}`);
}

/** 新增订阅 */
export function createWebhookApi(data: Partial<WebhookItem>): Promise<WebhookItem> {
  return post<WebhookItem>('/open/webhooks', data);
}

/** 更新订阅（secret 留空 = 不修改） */
export function updateWebhookApi(id: number, data: Partial<WebhookItem>): Promise<WebhookItem> {
  return put<WebhookItem>(`/open/webhooks/${id}`, data);
}

/** 删除订阅 */
export function deleteWebhookApi(id: number): Promise<null> {
  return del<null>(`/open/webhooks/${id}`);
}

/** 测试推送 */
export function testWebhookApi(id: number): Promise<WebhookDelivery> {
  return post<WebhookDelivery>(`/open/webhooks/${id}/test`);
}

/** 投递记录分页 */
export function listWebhookDeliveriesApi(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  event?: string;
}): Promise<{ list: WebhookDelivery[]; total: number }> {
  return get<{ list: WebhookDelivery[]; total: number }>('/open/webhook-deliveries', params);
}
