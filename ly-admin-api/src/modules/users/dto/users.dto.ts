/**
 * 用户模块入参 DTO（class-validator）。
 * 模块职责：用户增改、状态、重置密码、分配角色、路径 id 的校验规则。
 * 迁移自原 Express 版本的 validators/user.validator.ts（zod → class-validator），
 * 字段规则与原 schema 1:1，并通过 @Transform 还原原 zod 的默认值/类型归一行为。
 */
import { Transform, Type } from 'class-transformer';
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
import { REGEX } from '../../../common/constants.js';

/** 去除首尾空白（对字符串入参统一处理）。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 空串归一为 undefined，便于配合 @IsOptional 跳过校验（还原原 zod `z.literal('')` 语义）。 */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** 路径 id 参数（正整数）。 */
export class IdParamDto {
  @Type(() => Number)
  @IsInt({ message: 'id 必须为正整数' })
  @Min(1, { message: 'id 必须为正整数' })
  id!: number;
}

/** 新增用户。 */
export class CreateUserDto {
  /** 登录账号：3~20 位字母/数字/下划线 */
  @IsString({ message: '账号为 3~20 位字母、数字或下划线' })
  @Transform(trim)
  @IsNotEmpty({ message: '账号不能为空' })
  @Matches(REGEX.USERNAME, { message: '账号为 3~20 位字母、数字或下划线' })
  @MaxLength(20)
  username!: string;

  /** 明文密码：6~20 位 */
  @IsString({ message: '密码至少 6 位' })
  @Transform(trim)
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(20, { message: '密码最多 20 位' })
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
  @Min(0)
  @Max(1)
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
  @Min(0)
  deptId?: number;

  /** 备注（可空） */
  @IsOptional()
  @IsString()
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
  @Min(0)
  @Max(1)
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
  @Min(0)
  deptId?: number;

  /** 备注（可空） */
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 启用/禁用。 */
export class StatusDto {
  @Transform(({ value }) => Number(value))
  @IsInt({ message: '状态值不合法' })
  @Min(0)
  @Max(1)
  status!: number;
}

/** 重置密码。 */
export class ResetPasswordDto {
  @IsString({ message: '密码至少 6 位' })
  @Transform(trim)
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(20, { message: '密码最多 20 位' })
  password!: string;
}

/** 分配角色。 */
export class AssignRoleDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v: unknown) => Number(v)) : []))
  @IsArray({ message: '角色列表格式不正确' })
  roleIds?: number[];
}
