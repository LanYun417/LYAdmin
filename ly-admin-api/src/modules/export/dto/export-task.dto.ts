/**
 * 导出中心入参 DTO（class-validator）。
 * 模块职责：创建任务（模块白名单 + 筛选条件快照）、任务 id。
 */
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** 可导出的模块白名单（与 ExportTaskService.EXPORT_MODULES 的键一致）。 */
const MODULE_KEYS = ['login-log', 'operation-log', 'http-log'];

/** 筛选条件快照的键字符集（防注入与超长键）。 */
const QUERY_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** 创建导出任务。 */
export class CreateExportTaskDto {
  /** 导出模块（决定用哪类日志的查询与表头）。 */
  @IsIn(MODULE_KEYS, { message: '不支持的导出模块' })
  module!: string;

  /**
   * 筛选条件快照：前端把列表页当前的查询原样传来，后台按同一套 where 导出。
   * 限深限长：只接受「键字符集合法 + 值为原始类型」的浅层对象，
   * 拒绝嵌套对象/数组（导出条件不需要复杂结构，拒绝可防意外与滥用）。
   */
  @IsOptional()
  @IsObject({ message: '筛选条件必须为对象' })
  @Transform(({ value }) => sanitizeQuery(value))
  query?: Record<string, unknown>;

  /** 时区偏移（分钟）：CSV 时间列按此时区格式化，与请求头同一口径。 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '时区偏移必须为整数' })
  @Min(-720, { message: '时区偏移超出范围' })
  @Max(840, { message: '时区偏移超出范围' })
  timezoneOffset?: number;
}

/** 任务 id 路径参数。 */
export class ExportTaskIdParamDto {
  @Type(() => Number)
  @IsInt({ message: '任务 id 必须为整数' })
  @Min(1, { message: '任务 id 必须为正整数' })
  id!: number;
}

/**
 * 清洗筛选条件：只保留合法键 + 原始类型值，其余丢弃。
 * 与列表接口的宽松度差异是刻意的——这里的值会**原样落库**并在稍后回放，
 * 宁少勿滥（缺一个条件顶多少导一些，落进脏数据会在回放时炸）。
 */
function sanitizeQuery(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  for (const key of keys.slice(0, 20)) {
    if (!QUERY_KEY_PATTERN.test(key)) {
      continue;
    }
    const item = source[key];
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      // 字符串限长：防把整段 Base64 之类的怪东西塞进日志
      if (typeof item === 'string' && item.length > 200) {
        result[key] = item.slice(0, 200);
        continue;
      }
      result[key] = item;
    }
  }
  return result;
}

/** 列表查询的分页参数（与其它模块一致，前端 TablePage 直传）。 */
export class ExportTaskQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须为整数' })
  @Min(1, { message: '页码必须为正整数' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须为整数' })
  @Min(1, { message: '每页条数必须为正整数' })
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '模块必须为字符串' })
  @MaxLength(30, { message: '模块标识过长' })
  @Matches(/^[a-z-]+$/, { message: '模块标识仅限小写字母与连字符' })
  module?: string;
}
