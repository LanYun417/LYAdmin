/**
 * SSO 提供方配置 DTO。
 */
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** 新增 / 更新提供方（clientSecret 更新时留空表示不改）。 */
export class SsoProviderDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  /** OIDC issuer（校验 id_token 的 iss） */
  @IsString()
  @Length(1, 255)
  issuer!: string;

  @IsString()
  @Length(1, 500)
  authorizationUrl!: string;

  @IsString()
  @Length(1, 500)
  tokenUrl!: string;

  @IsString()
  @Length(1, 500)
  userInfoUrl!: string;

  /** JWKS 端点；留空 = 不验签（仅内网自建提供方建议） */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  jwksUrl?: string;

  @IsString()
  @Length(1, 255)
  clientId!: string;

  /** 新增必填；更新可留空（不修改） */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  clientSecret?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  scopes?: string;

  /** 后端接收 code 的完整回调地址 */
  @IsString()
  @Length(1, 500)
  redirectUri!: string;

  /** 字段映射 JSON（username/email/nickname/avatar 的 claim 名） */
  @IsOptional()
  @IsString()
  fieldMapping?: string;

  @IsOptional()
  @IsBoolean()
  linkByEmail?: boolean;

  /** 自动建号时授予的角色编码（逗号分隔） */
  @IsOptional()
  @IsString()
  @Length(0, 255)
  defaultRoleCodes?: string;

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

/** 前端用一次性 ticket 换登录态。 */
export class SsoRedeemDto {
  @IsString()
  @Length(10, 128)
  ticket!: string;
}
