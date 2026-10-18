/**
 * 用户模块入参 DTO（class-validator）。
 * 模块职责：用户增改、状态、重置密码、分配角色、路径 id 的校验规则。
 * 用 @Transform 统一做去空白 / 空串归一 / 默认值处理。
 */
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import { REGEX } from '../../../common/config/constants.js';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../common/auth/password-policy.js';
import { MSG } from '../../../common/utils/validation-messages.js';

/** 去除首尾空白（对字符串入参统一处理）。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 空串归一为 undefined，便于配合 @IsOptional 跳过校验。 */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** 新增用户。 */
export class CreateUserDto {
  /** 登录账号：3~20 位字母/数字/下划线 */
  @IsString({ message: '账号为 3~20 位字母、数字或下划线' })
  @Transform(trim)
  @IsNotEmpty({ message: '账号不能为空' })
  @Matches(REGEX.USERNAME, { message: '账号为 3~20 位字母、数字或下划线' })
  @MaxLength(20, { message: MSG.maxLength(20) })
  username!: string;

  /** 明文密码：长度与复杂度统一由 common/auth/password-policy.ts 决定 */
  @IsString({ message: PASSWORD_LENGTH_MESSAGE })
  @Transform(trim)
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;

  /** 昵称 */
  @IsString({ message: '昵称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称过长' })
  nickname!: string;

  /** 邮箱（可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '邮箱格式不正确' })
  @Matches(REGEX.EMAIL, { message: '邮箱格式不正确' })
  email?: string;

  /** 手机号（可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '手机号格式不正确' })
  @Matches(REGEX.PHONE, { message: '手机号格式不正确' })
  phone?: string;

  /** 性别（字典 sys_user_sex 的值，可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '性别值过长' })
  @MaxLength(20, { message: '性别值过长' })
  gender?: string;

  /** 状态：1 启用 / 0 禁用，默认 1 */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt({ message: '状态值不合法' })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  status?: number;

  /** 角色 id 列表，默认空 */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v: unknown) => Number(v)) : []))
  @IsArray({ message: '角色列表格式不正确' })
  roleIds?: number[];

  /** 部门 id（0 表示未分配），默认 0 */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @IsInt({ message: '部门 ID 不合法' })
  @Min(0, { message: MSG.min(0) })
  deptId?: number;

  /** 备注（可空） */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 编辑用户（部分字段，昵称必填，不允许改账号）。 */
export class UpdateUserDto {
  /** 昵称 */
  @IsString({ message: '昵称不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '昵称不能为空' })
  @MaxLength(50, { message: '昵称过长' })
  nickname!: string;

  /** 邮箱（可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '邮箱格式不正确' })
  @Matches(REGEX.EMAIL, { message: '邮箱格式不正确' })
  email?: string;

  /** 手机号（可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '手机号格式不正确' })
  @Matches(REGEX.PHONE, { message: '手机号格式不正确' })
  phone?: string;

  /** 性别（可空） */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString({ message: '性别值过长' })
  @MaxLength(20, { message: '性别值过长' })
  gender?: string;

  /** 状态：1 启用 / 0 禁用，默认 1 */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt({ message: '状态值不合法' })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  status?: number;

  /** 角色 id 列表，默认空 */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v: unknown) => Number(v)) : []))
  @IsArray({ message: '角色列表格式不正确' })
  roleIds?: number[];

  /** 部门 id（0 表示未分配），默认 0 */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @IsInt({ message: '部门 ID 不合法' })
  @Min(0, { message: MSG.min(0) })
  deptId?: number;

  /** 备注（可空） */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 启用/禁用。 */
export class StatusDto {
  @Transform(({ value }) => Number(value))
  @IsInt({ message: '状态值不合法' })
  @Min(0, { message: MSG.min(0) })
  @Max(1, { message: MSG.max(1) })
  status!: number;
}

/** 重置密码。 */
export class ResetPasswordDto {
  @IsString({ message: PASSWORD_LENGTH_MESSAGE })
  @Transform(trim)
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;
}

/** 分配角色。 */
export class AssignRoleDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v: unknown) => Number(v)) : []))
  @IsArray({ message: '角色列表格式不正确' })
  roleIds?: number[];
}
