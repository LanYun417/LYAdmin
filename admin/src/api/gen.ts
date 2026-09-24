import { get, post } from './request';

/* ------------------------------- 类型定义 ------------------------------- */

/** 代码生成：数据表（列表项） */
export interface GenTable {
  /** 表名（下划线形式，如 sys_user） */
  tableName: string;
  /** 表注释 */
  tableComment: string;
  /** 存储引擎 */
  engine: string;
  /** 建表时间 */
  createTime: string;
}

/** 代码生成：表字段 */
export interface GenColumn {
  /** 列名（下划线形式，如 user_name） */
  columnName: string;
  /** 字段名（驼峰形式，如 userName） */
  fieldName: string;
  /** 数据库列类型（如 varchar(64)） */
  columnType: string;
  /** 数据库数据类型（如 varchar） */
  dataType: string;
  /** 前端 TS 类型 */
  tsType: 'string' | 'number' | 'boolean' | 'Date';
  /** 字段注释 */
  columnComment: string;
  /** 是否主键 */
  isPk: boolean;
  /** 是否可为空（true 表示非必填） */
  isNullable: boolean;
}

/** 代码生成：表详情（含字段列表） */
export interface GenTableDetail {
  tableName: string;
  tableComment: string;
  columns: GenColumn[];
}

/** 代码生成：生成的文件 */
export interface GenFile {
  /** 文件相对路径 */
  path: string;
  /** 文件内容 */
  content: string;
}

/** 代码生成：预览结果 */
export interface GenPreviewResult {
  tableName: string;
  files: GenFile[];
}

/** 代码生成：生成配置 */
export interface GenConfig {
  /** 表名 */
  tableName: string;
  /** 模块名（如 system） */
  moduleName: string;
  /** 业务名（如 user） */
  businessName: string;
  /** 作者，可留空 */
  author?: string;
}

/* ------------------------------- 接口封装 ------------------------------- */

/** 全部数据表列表 */
export function getGenTablesApi(): Promise<GenTable[]> {
  return get<GenTable[]>('/gen/tables');
}

/** 指定数据表的字段详情 */
export function getGenTableDetailApi(tableName: string): Promise<GenTableDetail> {
  return get<GenTableDetail>(`/gen/tables/${encodeURIComponent(tableName)}`);
}

/** 预览生成的代码 */
export function previewGenCodeApi(data: GenConfig): Promise<GenPreviewResult> {
  return post<GenPreviewResult>('/gen/preview', data);
}

/** 下载生成的代码（ZIP 二进制流） */
export function downloadGenCodeApi(data: GenConfig): Promise<Blob> {
  return post<Blob>('/gen/download', data, { responseType: 'blob' });
}

/** 生成结果 */
export interface GenCreateResult {
  /** 成功写入的文件（相对项目根） */
  written: string[];
  /** 已自动接线的文件 */
  injected: string[];
  /** 生成后仍需人工完成的步骤 */
  manualSteps: string[];
}

/** 生成代码并直接写入项目目录（同名文件已存在时后端返回 409） */
export function createGenCodeApi(data: GenConfig, overwrite = false): Promise<GenCreateResult> {
  return post<GenCreateResult>('/gen/create', { ...data, overwrite });
}
