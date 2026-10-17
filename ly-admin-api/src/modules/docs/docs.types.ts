/**
 * 接口文档数据结构。
 * 模块职责：定义 `GET /api/docs` 返回的 JSON 形状，供服务端产出与前端消费共同遵循。
 *
 * 数据来源：由 `scripts/gen-api-docs.mjs` 在构建期用 TypeScript AST 扫描全部控制器生成
 * （见 `api-docs.generated.ts`），运行时不做反射，保证「文档 = 代码」的单一事实来源。
 */

/** 单个接口的请求 / 响应示例。 */
export interface ApiDocExamples {
  /** curl 命令（可直接复制执行；公开接口不带鉴权头） */
  curl: string;
  /** 路径参数示例（如 `{ id: '1' }`） */
  pathParams?: Record<string, string>;
  /** 查询参数示例 */
  query?: Record<string, unknown>;
  /** 请求体示例（由 DTO 自动合成） */
  requestBody?: Record<string, unknown>;
  /** 是否文件流响应（CSV / ZIP / 附件，无 JSON 响应体） */
  isRawResponse?: boolean;
  /** 响应示例（运行时由契约示例库补全，见 `api-examples.ts`） */
  response?: unknown;
}

/** 单个接口条目。 */
export interface ApiDocEndpoint {
  /** HTTP 方法：GET / POST / PUT / PATCH / DELETE */
  method: string;
  /** 完整路径（含全局前缀 /api，形如 `/api/users/:id`） */
  path: string;
  /** 接口说明（取自控制器方法的 JSDoc 首段） */
  summary: string;
  /** 所需权限码（命中任一即可；空数组表示仅需登录） */
  permission: string[];
  /** 是否公开接口（`@Public()`，无需登录） */
  isPublic: boolean;
  /** 操作日志语义（`@OperationLog` 的「模块 · 动作」，无则为空串） */
  action: string;
  /** 请求 / 响应示例 */
  examples: ApiDocExamples;
}

/** 按业务模块分组的接口集合。 */
export interface ApiDocGroup {
  /** 模块名（如「用户管理」） */
  group: string;
  /** 该模块下的接口列表 */
  endpoints: ApiDocEndpoint[];
}

/** 文档根结构（接口实际返回体）。 */
export interface ApiDocDocument {
  /** 全部模块分组 */
  groups: ApiDocGroup[];
  /** 接口总数 */
  total: number;
  /** 文档生成时间（ISO 8601，运行时填充） */
  generatedAt: string;
}
