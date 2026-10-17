/**
 * 接口文档控制器。
 * 模块职责：返回由构建期生成的接口清单（`@Public()` 公开接口，无需登录）。
 *
 * 数据来源：`api-docs.generated.ts`（由 `scripts/gen-api-docs.mjs` 扫描控制器生成）。
 * 返回体经全局响应拦截器包装为 `{ code, message, data }`，前端解包后即为文档数据。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth.guard.js';
import { API_DOCS } from './api-docs.generated.js';
import type { ApiDocDocument } from './docs.types.js';

@Controller('docs')
export class DocsController {
  /** 全部接口清单（按业务模块分组）。 */
  @Public()
  @Get()
  getDocs(): ApiDocDocument {
    const total = API_DOCS.reduce((sum, group) => sum + group.endpoints.length, 0);
    return { groups: API_DOCS, total, generatedAt: new Date().toISOString() };
  }
}
