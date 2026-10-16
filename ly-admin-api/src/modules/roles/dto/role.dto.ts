/**
 * 角色模块入参 DTO。
 * 模块职责：角色新增/编辑/授权菜单的请求体校验（class-validator）。
 * 全局 ValidationPipe 已开启 whitelist + transform，故这里用 @Type 做数值强转，
 * 与旧版 zod 的 coerce 语义一致。
 */
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MSG } from '../../../common/validation-messages.js';

/** 角色编码：字母开头，2~50 位字母/数字/下划线。 */
const ROLE_CODE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{1,49}$/;

/** 新增角色。 */
export class CreateRoleDto {
  @IsString({ message: MSG.isString })
  @MaxLength(50, { message: '角色名称过长' })
  roleName!: string;

  @IsString({ message: MSG.isString })
  @Matches(ROLE_CODE_REGEX, { message: '角色编码为字母开头，2~50 位字母/数字/下划线' })
  roleCode!: string;

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

  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(1, { message: MSG.min(1) })
  @Max(4, { message: MSG.max(4) })
  dataScope?: number = 1;

  /** 自定义部门 id 列表（dataScope=2 时生效） */
  @IsOptional()
  @Type(() => Number)
  @IsArray({ message: MSG.isArray })
  @IsInt({ each: true, message: MSG.eachInt })
  @Min(1, { each: true, message: MSG.eachMin(1) })
  deptIds?: number[] = [];

  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 编辑角色（不含 roleCode）。 */
export class UpdateRoleDto {
  @IsString({ message: MSG.isString })
  @MaxLength(50, { message: '角色名称过长' })
  roleName!: string;

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

  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: MSG.isInt })
  @Min(1, { message: MSG.min(1) })
  @Max(4, { message: MSG.max(4) })
  dataScope?: number = 1;

  /** 自定义部门 id 列表（dataScope=2 时生效） */
  @IsOptional()
  @Type(() => Number)
  @IsArray({ message: MSG.isArray })
  @IsInt({ each: true, message: MSG.eachInt })
  @Min(1, { each: true, message: MSG.eachMin(1) })
  deptIds?: number[] = [];

  @IsOptional()
  @IsString({ message: MSG.isString })
  @MaxLength(255, { message: '备注过长' })
  remark?: string;
}

/** 授权菜单。 */
export class AssignMenuDto {
  @IsOptional()
  @Type(() => Number)
  @IsArray({ message: MSG.isArray })
  @IsInt({ each: true, message: MSG.eachInt })
  @Min(1, { each: true, message: MSG.eachMin(1) })
  menuIds?: number[] = [];
}
