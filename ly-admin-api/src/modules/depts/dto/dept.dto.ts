/**
 * 部门模块入参 DTO。
 * 模块职责：部门新增/编辑的请求体校验（class-validator）。
 * 全局 ValidationPipe 已开启 whitelist + transform，故用 @Type 做数值强转，
 * 新增与编辑共用同一 Upsert 结构（编辑时前端传全量）。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MSG } from '../../../common/validation-messages.js';

/** 新增/编辑部门。 */
export class DeptUpsertDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  parentId?: number = 0;

  /** 类型：1 部门 / 2 岗位（岗位为叶子节点，不能再挂下级） */
  @IsInt({ message: MSG.isInt })
  @Min(1, { message: '类型值不在允许范围' })
  @Max(2, { message: '类型值不在允许范围' })
  deptType!: number;

  @IsString({ message: MSG.isString })
  @MaxLength(50, { message: '名称过长' })
  deptName!: string;

  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(20, { message: '负责人名称过长' })
  leader?: string;

  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(20, { message: '联系电话过长' })
  phone?: string;

  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(100, { message: '邮箱过长' })
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  sort?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  status?: number = 1;
}
