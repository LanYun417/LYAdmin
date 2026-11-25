/**
 * IP 访问控制规则 DTO（class-validator）。
 * 约定：
 * - ip 创建后不可修改（编辑 DTO 不含该字段），与 configKey / dictType 的处理一致；
 * - 查询参数不走 DTO，统一用 Record<string, unknown> + 工具函数解析。
 */
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MSG } from '../../../common/utils/validation-messages.js';

/** 规则类型：1 黑名单 / 2 白名单。 */
export const RULE_TYPES = [1, 2] as const;

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** 新增规则。 */
export class CreateIpRuleDto {
  /** IP 或 CIDR 段 */
  @IsString({ message: MSG.isString })
  @Transform(trim)
  @MaxLength(100, { message: 'IP 规则过长' })
  ip!: string;

  /** 规则类型：1 黑名单 / 2 白名单 */
  @IsInt({ message: '规则类型必须为整数' })
  @IsIn(RULE_TYPES, { message: '规则类型只能为黑名单或白名单' })
  ruleType!: number;

  /** 备注（封禁原因等） */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;

  /** 过期时间（ISO 字符串；不传表示永久） */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  expiresAt?: string | null;
}

/** 编辑规则（ip 不可改，避免改 IP 后命中计数与历史语义错位）。 */
export class UpdateIpRuleDto {
  /** 规则类型 */
  @IsInt({ message: '规则类型必须为整数' })
  @IsIn(RULE_TYPES, { message: '规则类型只能为黑名单或白名单' })
  ruleType!: number;

  /** 备注 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  @Transform(trim)
  @MaxLength(255, { message: '备注过长' })
  remark?: string;

  /** 过期时间 */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  expiresAt?: string | null;
}
