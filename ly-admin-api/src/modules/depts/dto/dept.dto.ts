/**
 * 部门模块入参 DTO。
 * 模块职责：部门新增/编辑的请求体校验（class-validator）。
 * 全局 ValidationPipe 已开启 whitelist + transform，故用 @Type 做数值强转，
 * 与旧版 zod 的 coerce 语义一致。新增与编辑共用同一 Upsert 结构（编辑时前端传全量）。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 新增/编辑部门。 */
export class DeptUpsertDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  parentId?: number = 0;

  @IsString()
  @MaxLength(50, { message: '部门名称过长' })
  deptName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '负责人名称过长' })
  leader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '联系电话过长' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '邮箱过长' })
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number = 1;
}
