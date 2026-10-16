/**
 * 字典模块 DTO（class-validator）。
 * 模块职责：字典类型 / 字典项的新增、编辑、启停用入参校验。
 * 迁移自原 Express 版本的 validators/dict.validator.ts（zod → class-validator）。
 *
 * 约定：
 * - 编辑 DTO 不含 `dictType`（类型编码创建后不可修改），白名单模式下即便前端误传也会被剔除；
 * - 查询参数不走 DTO，统一用 `@Query() query: Record<string, unknown>` + 工具函数解析。
 */
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/** 去除首尾空白（对字符串入参统一处理）。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 字典类型编码：字母开头，2~100 位字母/数字/下划线（业务引用键）。 */
export const DICT_TYPE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{1,99}$/;

/** 新增字典类型。 */
export class CreateDictTypeDto {
  /** 字典名称 */
  @IsString({ message: '字典名称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典名称不能为空' })
  @MaxLength(100, { message: '字典名称过长' })
  dictName!: string;

  /** 字典类型编码（业务引用键，创建后不可修改） */
  @IsString({ message: '字典类型编码不能为空' })
  @Transform(trim)
  @Matches(DICT_TYPE_REGEX, { message: '字典类型编码为字母开头，2~100 位字母/数字/下划线' })
  dictType!: string;

  /** 状态：1 启用 / 0 禁用 */
  @IsOptional()
  @IsInt({ message: '状态必须为整数' })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => value ?? 1)
  status?: number;

  /** 备注 */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 编辑字典类型（不含 dictType）。 */
export class UpdateDictTypeDto {
  /** 字典名称 */
  @IsString({ message: '字典名称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典名称不能为空' })
  @MaxLength(100, { message: '字典名称过长' })
  dictName!: string;

  /** 状态：1 启用 / 0 禁用 */
  @IsOptional()
  @IsInt({ message: '状态必须为整数' })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => value ?? 1)
  status?: number;

  /** 备注 */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 新增字典项。 */
export class CreateDictItemDto {
  /** 所属字典类型编码 */
  @IsString({ message: '字典类型不能为空' })
  @Transform(trim)
  @Matches(DICT_TYPE_REGEX, { message: '字典类型编码为字母开头，2~100 位字母/数字/下划线' })
  dictType!: string;

  /** 字典标签（展示文案） */
  @IsString({ message: '字典标签不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典标签不能为空' })
  @MaxLength(100, { message: '字典标签过长' })
  dictLabel!: string;

  /** 字典值（业务存储值） */
  @IsString({ message: '字典值不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典值不能为空' })
  @MaxLength(100, { message: '字典值过长' })
  dictValue!: string;

  /** 排序 */
  @IsOptional()
  @IsInt({ message: '排序必须为整数' })
  @Min(0)
  @Max(9999)
  @Transform(({ value }) => value ?? 0)
  sort?: number;

  /** 状态：1 启用 / 0 禁用 */
  @IsOptional()
  @IsInt({ message: '状态必须为整数' })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => value ?? 1)
  status?: number;

  /** 备注 */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 编辑字典项（不含 dictType）。 */
export class UpdateDictItemDto {
  /** 字典标签（展示文案） */
  @IsString({ message: '字典标签不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典标签不能为空' })
  @MaxLength(100, { message: '字典标签过长' })
  dictLabel!: string;

  /** 字典值（业务存储值） */
  @IsString({ message: '字典值不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '字典值不能为空' })
  @MaxLength(100, { message: '字典值过长' })
  dictValue!: string;

  /** 排序 */
  @IsOptional()
  @IsInt({ message: '排序必须为整数' })
  @Min(0)
  @Max(9999)
  @Transform(({ value }) => value ?? 0)
  sort?: number;

  /** 状态：1 启用 / 0 禁用 */
  @IsOptional()
  @IsInt({ message: '状态必须为整数' })
  @Min(0)
  @Max(1)
  @Transform(({ value }) => value ?? 1)
  status?: number;

  /** 备注 */
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 启停用（类型 / 项通用）。 */
export class SetStatusDto {
  /** 目标状态：1 启用 / 0 禁用 */
  @IsInt({ message: '状态必须为整数' })
  @Min(0)
  @Max(1)
  status!: number;
}
