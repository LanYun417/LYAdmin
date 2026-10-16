/**
 * 个人中心模块入参 DTO（class-validator）。
 * 模块职责：修改资料、修改密码的校验规则（由原 zod schema 迁移，规则 1:1）。
 * 说明：邮箱/手机允许空串（表示清空），故正则合并「空串或合法值」；与前端契约一致。
 */
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { REGEX } from '../../../common/constants.js';

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
  @IsString()
  @Matches(new RegExp(`^$|${REGEX.EMAIL.source}`), { message: '邮箱格式不正确' })
  email?: string;

  /** 手机号：空串或合法手机号。 */
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^$|${REGEX.PHONE.source}`), { message: '手机号格式不正确' })
  phone?: string;

  /** 性别：空串或最多 20 字符。 */
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '性别值过长' })
  gender?: string;

  /** 头像地址：最多 255 字符。 */
  @IsOptional()
  @IsString()
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
  @Matches(REGEX.PASSWORD, { message: '密码格式不正确（6~20 位非空白字符）' })
  newPassword!: string;
}
