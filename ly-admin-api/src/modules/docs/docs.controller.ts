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
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth.guard.js';
import { API_DOCS } from './api-docs.generated.js';
import { responseExampleOf } from './api-examples.js';
import type { ApiDocDocument } from './docs.types.js';

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
}
