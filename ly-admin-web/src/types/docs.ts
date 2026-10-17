/**
 * 接口文档相关类型定义。
 * 与后端 `src/modules/docs/docs.types.ts` 保持一一对应（数据结构由构建期生成）。
 */

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
