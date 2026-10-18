/**
 * 认证模块 DTO。
 * 模块职责：定义登录 / 刷新请求的入参校验规则。
 */
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MSG } from '../../../common/validation-messages.js';

/** 去除首尾空白（对字符串入参统一处理）。 */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class LoginDto {
  /** 登录账号 */
  @IsString({ message: '账号不能为空' })
  @Transform(trim)
  @IsNotEmpty({ message: '账号不能为空' })
  @MaxLength(50, { message: '账号长度不能超过 50' })
  username!: string;

  /** 明文密码 */
  @IsString({ message: '密码不能为空' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MaxLength(100, { message: '密码长度不能超过 100' })
  password!: string;

  /** 验证码 id（验证码启用时必填，由前端从 /auth/captcha 获取） */
  @IsOptional()
  @IsString({ message: MSG.isString })
  captchaId?: string;

  /** 用户输入的验证码 */
  @IsOptional()
  @IsString({ message: MSG.isString })
  captchaCode?: string;
}

export class RefreshDto {
  /** 刷新令牌（refreshToken） */
  @IsString({ message: '刷新令牌不能为空' })
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken!: string;
}
