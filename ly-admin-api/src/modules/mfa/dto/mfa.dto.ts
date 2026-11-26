/**
 * 多因素认证（TOTP）DTO。
 */
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** 开始绑定二次验证（需登录口令，防他人 sesssion 劫持后静默加第二因子）。 */
export class MfaSetupDto {
  @IsString()
  @Length(1, 64)
  password!: string;
}

/** 6 位动态码（TOTP）。 */
export class MfaEnableDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: '动态码必须是 6 位数字' })
  code!: string;
}

/** 解绑二次验证（需登录口令：仅凭会话不够，防会话劫持后剥掉安全层）。 */
export class MfaDisableDto {
  @IsString()
  @Length(1, 64)
  password!: string;
}

/** 登录第二因子验证（公开接口：凭挑战令牌 + 动态码换正式令牌）。 */
export class MfaVerifyLoginDto {
  /** 登录流程下发的挑战令牌（mfaToken） */
  @IsString()
  @Length(10, 2048)
  mfaToken!: string;

  /** 动态码或恢复码（恢复码含连字符，放宽字符集） */
  @IsString()
  @Length(6, 32)
  code!: string;

  /** 可选：客户端时区偏移（与登录请求保持一致口径，暂无业务用途，预留） */
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(720)
  timezoneOffset?: number;
}
