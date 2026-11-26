/**
 * LDAP 配置 DTO。
 */
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** 保存配置（编辑时 bindPassword 可留空 = 不修改）。 */
export class SaveLdapConfigDto {
  @IsBoolean()
  enabled!: boolean;

  /** 服务器地址（ldap:// 或 ldads://） */
  @IsString()
  @Length(1, 255)
  url!: string;

  @IsOptional()
  @IsBoolean()
  startTls?: boolean;

  @IsOptional()
  @IsBoolean()
  verifyCert?: boolean;

  /** 服务账号 DN */
  @IsString()
  @Length(1, 255)
  bindDn!: string;

  /** 服务账号口令（留空 = 不修改原口令） */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bindPassword?: string;

  /** 用户搜索基准 DN */
  @IsString()
  @Length(1, 255)
  baseDn!: string;

  /** 过滤器模板，必须含 {{username}} */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userFilter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  usernameAttr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  emailAttr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nicknameAttr?: string;

  /** 默认角色编码（逗号分隔） */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultRoleCodes?: string;
}

/** 连接测试参数（不落库，用于「保存前先测」）。 */
export class TestLdapConfigDto {
  @IsString()
  @Length(1, 255)
  url!: string;

  @IsString()
  @Length(1, 255)
  bindDn!: string;

  @IsString()
  @MaxLength(255)
  bindPassword!: string;

  @IsString()
  @Length(1, 255)
  baseDn!: string;

  @IsOptional()
  @IsBoolean()
  verifyCert?: boolean;

  @IsOptional()
  @IsBoolean()
  startTls?: boolean;
}
