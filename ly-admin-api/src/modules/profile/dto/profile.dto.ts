/**
 * 个人中心模块入参 DTO（class-validator）。
 * 模块职责：修改资料、修改密码的校验规则。
 * 说明：邮箱/手机允许空串（表示清空），故正则合并「空串或合法值」；与前端契约一致。
 */
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { REGEX } from '../../../common/config/constants.js';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../common/auth/password-policy.js';
import { MSG } from '../../../common/utils/validation-messages.js';

/** 去除首尾空白。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 修改个人资料。 */
export class UpdateProfileDto {
  @Type(() => String)
  @IsString({ message: '昵称必须为字符串' })
  @MinLength(1, { message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称过长' })
  @Transform(trim)
  nickname!: string;

  /** 邮箱：空串或合法邮箱（空串表示清空）。 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Matches(new RegExp(`^$|${REGEX.EMAIL.source}`), { message: '邮箱格式不正确' })
  email?: string;

  /** 手机号：空串或合法手机号。 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Matches(new RegExp(`^$|${REGEX.PHONE.source}`), { message: '手机号格式不正确' })
  phone?: string;

  /** 性别：空串或最多 20 字符。 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(20, { message: '性别值过长' })
  gender?: string;

  /** 头像地址：最多 255 字符。 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: '头像地址过长' })
  avatar?: string;
}

/** 修改密码。 */
export class ChangePasswordDto {
  @Type(() => String)
  @IsString({ message: '原密码必须为字符串' })
  @IsNotEmpty({ message: '原密码不能为空' })
  oldPassword!: string;

  @Type(() => String)
  @IsString({ message: '新密码必须为字符串' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  newPassword!: string;
}

/** 更新扩展资料（Sprint 5：个人中心资料域字段）。 */
export class UpdateProfileExtraDto {
  /** 个人简介（签名）：空串表示清空。 */
  @IsOptional()
  @Type(() => String)
  @IsString({ message: MSG.isString })
  @MaxLength(200, { message: '简介最长 200 个字符' })
  @Transform(trim)
  signature?: string;

  /** 生日：`YYYY-MM-DD`；空串 / 不传表示保留或清空（null 清空）。 */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '生日格式应为 YYYY-MM-DD' })
  birthday?: string | null;

  /** 公司 / 组织：空串表示清空。 */
  @IsOptional()
  @Type(() => String)
  @IsString({ message: MSG.isString })
  @MaxLength(100, { message: '公司名最长 100 个字符' })
  @Transform(trim)
  company?: string;

  /** 职位 / 岗位：空串表示清空。 */
  @IsOptional()
  @Type(() => String)
  @IsString({ message: MSG.isString })
  @MaxLength(50, { message: '职位最长 50 个字符' })
  @Transform(trim)
  position?: string;

  /** 所在地：空串表示清空。 */
  @IsOptional()
  @Type(() => String)
  @IsString({ message: MSG.isString })
  @MaxLength(200, { message: '所在地最长 200 个字符' })
  @Transform(trim)
  address?: string;
}
