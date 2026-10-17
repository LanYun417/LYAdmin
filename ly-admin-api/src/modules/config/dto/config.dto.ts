/**
 * 系统参数模块 DTO（class-validator）。
 * 模块职责：参数新增、编辑入参校验。
 *
 * 约定：
 * - 编辑 DTO 不含 `configKey`（键名即业务引用键，创建后不可修改），白名单模式下即便前端误传也会被剔除；
 * - 查询参数不走 DTO，统一用 `@Query() query: Record<string, unknown>` + 工具函数解析。
 */
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MSG } from '../../../common/validation-messages.js';

/** 去除首尾空白（对字符串入参统一处理）。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 参数键名：字母开头，2~100 位字母/数字/点/下划线（业务引用键）。 */
export const CONFIG_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9._]{1,99}$/;

/** 新增参数。configKey 即业务引用键，创建后不可修改。 */
export class CreateConfigDto {
  /** 参数名称 */
  @IsString({ message: '参数名称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '参数名称不能为空' })
  @MaxLength(100, { message: '参数名称过长' })
  configName!: string;

  /** 参数键名（业务引用键，创建后不可修改） */
  @IsString({ message: '参数键名不能为空' })
  @Transform(trim)
  @Matches(CONFIG_KEY_REGEX, { message: '参数键名为字母开头，2~100 位字母/数字/点/下划线' })
  configKey!: string;

  /** 参数值 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(500, { message: '参数值过长' })
  @Transform(({ value }) => value ?? '')
  configValue?: string;

  /** 备注 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 编辑参数（不含 configKey，键名创建后不可修改）。 */
export class UpdateConfigDto {
  /** 参数名称 */
  @IsString({ message: '参数名称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '参数名称不能为空' })
  @MaxLength(100, { message: '参数名称过长' })
  configName!: string;

  /** 参数值 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(500, { message: '参数值过长' })
  @Transform(({ value }) => value ?? '')
  configValue?: string;

  /** 备注 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}
