/**
 * 接口文档模块入口（barrel）。
 * 模块职责：
 * - 对外统一导出文档数据、渲染与覆盖校验能力；
 * - 提供 `registerDocsRoutes(app)`，注册零依赖自建接口文档页面与数据接口。
 */
import type { Express, Request, Response } from 'express';
import {
  ALL_ENDPOINTS,
  DOC_TITLE,
  ENDPOINT_TOTAL,
  GENERAL,
  MODULES,
  type EndpointDoc,
  type GeneralDoc,
  type ModuleDoc,
} from '@/docs/catalog';
import { renderDocsHtml } from '@/docs/render';

export { ALL_ENDPOINTS, DOC_TITLE, ENDPOINT_TOTAL, GENERAL, MODULES, buildProbeMounts } from '@/docs/catalog';
export type { EndpointDoc, GeneralDoc, HttpMethod, ModuleDoc, ParamDoc } from '@/docs/catalog';
export { renderDocsHtml } from '@/docs/render';
export { auditDocsCoverage } from '@/docs/routeAudit';

/** 文档数据接口（/api-docs/data.json）的响应结构。 */
export interface DocsData {
  /** 文档标题 */
  title: string;
  /** 服务基地址 */
  baseUrl: string;
  /** 接口总数 */
  total: number;
  /** 数据生成时间（ISO 8601） */
  generatedAt: string;
  /** 通用说明 */
  general: GeneralDoc;
  /** 分组后的接口目录 */
  modules: ModuleDoc[];
  /** 扁平接口列表 */
  endpoints: EndpointDoc[];
}

/**
 * 构建文档数据对象（供 /api-docs/data.json 消费）。
 * @returns 文档数据
 */
export function buildDocsData(): DocsData {
  return {
    title: DOC_TITLE,
    baseUrl: GENERAL.baseUrl,
    total: ENDPOINT_TOTAL,
    generatedAt: new Date().toISOString(),
    general: GENERAL,
    modules: MODULES,
    endpoints: ALL_ENDPOINTS,
  };
}

/**
 * 注册接口文档路由：
 * - `GET /api-docs`：自包含 HTML 页面；
 * - `GET /api-docs/data.json`：原始 JSON 数据（便于程序消费）。
 * 说明：`/api-docs` 不在 `/api` 之下，不会与 `/api` 业务路由冲突；文档为公开访问（不含敏感信息）。
 * @param app Express 应用实例
 */
export function registerDocsRoutes(app: Express): void {
  app.get('/api-docs', (_req: Request, res: Response) => {
    const html = renderDocsHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  });

  app.get('/api-docs/data.json', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(buildDocsData());
  });
}
