/**
 * 告警中心 DTO。
 */
import { IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** 渠道类型枚举（与 channels.ts 的分发器一致）。 */
const CHANNEL_TYPE_VALUES = ['email', 'webhook', 'dingtalk', 'wecom', 'feishu'];
/** 告警级别枚举。 */
const LEVEL_VALUES = ['info', 'warning', 'critical'];

/** 新增 / 更新告警渠道。 */
export class AlertChannelDto {
  @IsIn(CHANNEL_TYPE_VALUES, { message: '不支持的渠道类型' })
  type!: string;

  @IsString()
  @Length(1, 50)
  name!: string;

  /** 渠道配置 JSON（邮件 host/port/secure/user/pass/from/to；Webhook 类 webhook/url/secret） */
  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 新增 / 更新告警规则。 */
export class AlertRuleDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  /** 事件类型（如 export.failed / login.bruteForce / monitor.disk） */
  @IsString()
  @Length(1, 50)
  eventType!: string;

  @IsIn(LEVEL_VALUES, { message: '不支持的告警级别' })
  level!: string;

  /** 渠道 id 列表 */
  @IsArray()
  @IsNumber({}, { each: true })
  channelIds!: number[];

  /** 冷却秒数（0 = 不冷却） */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldownSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  remark?: string;
}

/** 记录列表查询。 */
export class AlertRecordQueryDto {
  @IsOptional()
  @IsIn(['pending', 'sent', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  eventType?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
