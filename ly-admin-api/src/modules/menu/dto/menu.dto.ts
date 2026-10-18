/**
 * 菜单模块入参 DTO。
 * 模块职责：菜单新增 / 编辑的请求体校验（class-validator）。
 * 全局 ValidationPipe 已开启 whitelist + transform，故用 @Type 做数值强转；
 * 新增与编辑共用同一 Upsert 结构（编辑时前端传全量）。
 */
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MSG } from '../../../common/utils/validation-messages.js';

/** 去首尾空白；空串归一为 undefined（可选字段传空串视为不设置）。 */
const trimToOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** 新增 / 编辑菜单。 */
export class MenuUpsertDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  parentId?: number = 0;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: MSG.isString })
  @IsNotEmpty({ message: '菜单名称不能为空' })
  @MaxLength(50, { message: MSG.maxLength(50) })
  menuName!: string;

  @IsIn(['M', 'C', 'F'], { message: '菜单类型非法' })
  menuType!: 'M' | 'C' | 'F';

  @IsOptional()
  @Transform(trimToOptional)
  @IsString({ message: MSG.isString })
  @MaxLength(200, { message: MSG.maxLength(200) })
  path?: string;

  @IsOptional()
  @Transform(trimToOptional)
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: MSG.maxLength(255) })
  component?: string;

  @IsOptional()
  @Transform(trimToOptional)
  @IsString({ message: MSG.isString })
  @MaxLength(100, { message: MSG.maxLength(100) })
  icon?: string;

  @IsOptional()
  @Transform(trimToOptional)
  @IsString({ message: MSG.isString })
  @MaxLength(100, { message: MSG.maxLength(100) })
  permission?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  @Max(9999, { message: MSG.max(9999) })
  sort?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  visible?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  status?: number = 1;

  @IsOptional()
  @Transform(trimToOptional)
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: MSG.maxLength(255) })
  redirect?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  keepAlive?: number = 0;
}
