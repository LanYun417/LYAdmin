/**
 * API Key / Webhook DTO。
 */
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

/** 密钥状态（启停）。 */
const STATUS_VALUES = [0, 1];

/** 新增 API Key（响应里唯一一次返回明文密钥）。 */
export class CreateApiKeyDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  /** 所属用户 id：Key 以该用户身份调用接口 */
  @IsNumber()
  @Min(1)
  userId!: number;

  /** 权限范围：空 = 与所属用户一致；否则在其权限内取交集 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  scopes?: string[];

  /** 允许的调用 IP / CIDR；空 = 不限制 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  allowIps?: string[];

  /** 过期时间 ISO 串；缺省 = 永久 */
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 更新 API Key（密钥本体不可改：旋转 = 删旧建新）。 */
export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowIps?: string[];

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 新增 / 更新 Webhook 订阅。 */
export class WebhookDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsString()
  @Length(1, 500)
  url!: string;

  /** 订阅事件名列表；空 = 全部事件 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  events?: string[];

  /** 签名密钥（更新时留空 = 不修改） */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  secret?: string;

  @IsOptional()
  @IsInt()
  @IsIn(STATUS_VALUES)
  status?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 投递记录查询。 */
export class WebhookDeliveryQueryDto {
  @IsOptional()
  @IsIn(['ok', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}

/** API Key 列表查询。 */
export class ApiKeyQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 50)
  name?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}

/** 幂等键（预留：调用方显式声明防重复推送）。 */
export class WebhookIdempotencyDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events?: string[];
}
