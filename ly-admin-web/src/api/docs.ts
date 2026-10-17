/**
 * 接口文档接口。
 * 模块职责：拉取后端构建期生成的接口清单（`GET /api/docs`，公开接口）。
 */
import { get } from './request';
import type { ApiDocDocument } from '@/types/docs';

/** 获取全部接口清单（按模块分组） */
export function getApiDocsApi(): Promise<ApiDocDocument> {
  return get<ApiDocDocument>('/docs');
}
