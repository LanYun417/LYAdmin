/**
 * 接口文档相关类型定义。
 * 与后端 `src/modules/docs/docs.types.ts` 保持一一对应（数据结构由构建期生成）。
 */

/** 单个接口的请求 / 响应示例 */
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
  /** 响应示例（对象为 JSON；字符串为文件流等文字说明） */
  response?: unknown;
}

/** 单个请求参数的明细（结构化的参数说明） */
export interface ApiDocParam {
  /** 参数名 */
  name: string;
  /** 参数位置：path（路径参数）/ query（查询参数）/ body（请求体字段） */
  in: 'path' | 'query' | 'body';
  /** 类型（如 string / number / string[] / CreateRoleDto） */
  type: string;
  /** 是否必填 */
  required: boolean;
  /** 备注说明（取自 DTO 字段的 JSDoc） */
  description: string;
  /** 示例值 */
  example?: unknown;
}

/** 单个接口条目 */
export interface ApiDocEndpoint {
  /** HTTP 方法：GET / POST / PUT / PATCH / DELETE */
  method: string;
  /** 完整路径（含全局前缀 /api） */
  path: string;
  /** 接口说明 */
  summary: string;
  /** 所需权限码（命中任一即可；空数组表示仅需登录） */
  permission: string[];
  /** 是否公开接口（无需登录） */
  isPublic: boolean;
  /** 操作日志语义（「模块 · 动作」，无则为空串） */
  action: string;
  /** 请求参数明细（按 path / query / body 分类，含类型与备注） */
  params?: ApiDocParam[];
  /** 请求 / 响应示例 */
  examples: ApiDocExamples;
}

/** 按业务模块分组的接口集合 */
export interface ApiDocGroup {
  group: string;
  endpoints: ApiDocEndpoint[];
}

/** 接口文档根结构 */
export interface ApiDocDocument {
  groups: ApiDocGroup[];
  /** 接口总数 */
  total: number;
  /** 文档生成时间（ISO 8601） */
  generatedAt: string;
}
