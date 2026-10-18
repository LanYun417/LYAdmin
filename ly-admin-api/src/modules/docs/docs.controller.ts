/**
 * 接口文档控制器。
 * 模块职责：返回接口清单（路径 / 权限码 / 说明 / 请求与响应示例），供前端文档页展示。
 *
 * 数据来源：
 * - 请求侧（curl / 路径参数 / 查询 / 请求体）：`api-docs.generated.ts`，由
 *   `scripts/gen-api-docs.mjs` 在构建期扫描控制器与 DTO 生成（勿手改）；
 * - 响应侧：`api-examples.ts` 契约示例库，运行时按 `METHOD /path` 合并。
 *
 * 返回体经全局响应拦截器包装为 `{ code, message, data }`，前端解包后即为文档数据。
 */
import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../../common/auth.guard.js';
import { RawResponse } from '../../common/response.interceptor.js';
import { API_DOCS } from './api-docs.generated.js';
import { OPENAPI_DOC } from './openapi.generated.js';
import { responseExampleOf } from './api-examples.js';
import type { ApiDocDocument } from './docs.types.js';

/** OpenAPI 操作对象的轻量形状（仅取注入示例所需字段）。 */
interface OasOperation {
  responses?: {
    '200'?: {
      content?: {
        'application/json'?: { example?: unknown };
      };
    };
  };
}

/** 深拷贝（产物为纯 JSON，无函数，JSON 往返安全）。 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 把运行时契约示例库里的响应示例注入 OpenAPI 文档的 200 响应。
 * 构建期只生成结构（schema + 信封），具体样例值来自 `api-examples.ts`，在此补上，
 * 使 Swagger UI / Postman 能直接看到真实返回样例。
 */
function injectResponseExamples(doc: Record<string, unknown>): Record<string, unknown> {
  const paths = doc.paths as Record<string, Record<string, OasOperation>> | undefined;
  if (!paths) {
    return doc;
  }
  for (const group of API_DOCS) {
    for (const endpoint of group.endpoints) {
      const oasPath = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      const op = paths[oasPath]?.[endpoint.method.toLowerCase()];
      const json = op?.responses?.['200']?.content?.['application/json'];
      if (!json) {
        continue;
      }
      if (endpoint.examples.isRawResponse) {
        continue;
      }
      const example = responseExampleOf(endpoint.method, endpoint.path, endpoint.examples.isRawResponse);
      // responseExampleOf 返回的已是完整信封 { code, message, data }，直接作为 200 响应的 example
      json.example = example;
    }
  }
  return doc;
}

@Controller('docs')
export class DocsController {
  /** 全部接口清单（按业务模块分组）。 */
  @Public()
  @Get()
  getDocs(): ApiDocDocument {
    // 合并响应示例：构建期产物只含请求侧，响应侧在此按契约库补全
    const groups = API_DOCS.map((group) => ({
      group: group.group,
      endpoints: group.endpoints.map((endpoint) => ({
        ...endpoint,
        examples: {
          ...endpoint.examples,
          response: responseExampleOf(endpoint.method, endpoint.path, endpoint.examples.isRawResponse),
        },
      })),
    }));
    const total = groups.reduce((sum, group) => sum + group.endpoints.length, 0);
    return { groups, total, generatedAt: new Date().toISOString() };
  }

  /** OpenAPI 3.0 文档（注入响应示例，server 指向当前运行实例，可直接被 Swagger UI 消费）。 */
  @Public()
  @RawResponse()
  @Get('openapi.json')
  getOpenApi(@Req() req: { protocol: string; get(header: string): string | undefined }): Record<string, unknown> {
    const doc = deepClone(OPENAPI_DOC);
    const host = req.get('host');
    if (host) {
      doc.servers = [{ url: `${req.protocol || 'http'}://${host}`, description: '当前运行环境' }];
    }
    return injectResponseExamples(doc);
  }
}
