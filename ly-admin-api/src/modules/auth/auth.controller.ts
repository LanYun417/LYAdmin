/**
 * 认证控制器。
 * 模块职责：解析请求参数、调用认证服务，交由全局拦截器组装统一响应。
 */
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../common/exception/app.exception.js';
import { CaptchaService } from '../../common/auth/captcha.service.js';
import { LoginRateLimiterService } from '../../common/auth/login-rate-limit.service.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { CurrentUser, Public, type AuthenticatedRequest } from '../../common/auth/auth.guard.js';
import { getClientIp } from '../../common/log/operation-log.interceptor.js';
import { isResponseEnvelope } from '../../common/http/response.interceptor.js';
import type { AuthUserContext } from '../../common/types.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto } from './dto/auth.dto.js';
import { MenuService } from '../menu/menu.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly menuService: MenuService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  /** 图形验证码：公开接口（登录前获取）。 */
  @Public()
  @Get('captcha')
  async captcha(): Promise<unknown> {
    return this.captchaService.createCaptcha();
  }

  /**
   * 登录。
   * 挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）。
   */
  @Public()
  @Post('login')
  @OperationLog('认证', '登录')
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<unknown> {
    await this.rateLimiter.assertNotLocked(req);
    const userAgent = String(req.headers['user-agent'] ?? '');
    const ip = getClientIp(req);

    try {
      const result = await this.authService.login(
        dto.username,
        dto.password,
        dto.captchaId,
        dto.captchaCode,
        ip,
        userAgent,
      );
      // 登录成功清零失败计数
      await this.rateLimiter.clear(req);
      return isResponseEnvelope(result) ? result : { __raw: true, data: result, message: '登录成功' };
    } catch (error) {
      // 仅账号密码类失败计入频率限制；验证码错误不计入（避免验证码被爆破无谓锁号）
      if (error instanceof AppException && error.code === 401) {
        await this.rateLimiter.recordFailure(req);
      }
      throw error;
    }
  }

  /** 刷新 Token。 */
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto): Promise<unknown> {
    return this.authService.refresh(dto.refreshToken);
  }

  /** 登出。 */
  @Post('logout')
  async logout(@CurrentUser() user: AuthUserContext, @Req() req: AuthenticatedRequest): Promise<null> {
    // 带上当前会话 id：登出后在线用户列表要立即少一条（会话记录与令牌黑名单是两件事）
    await this.authService.logout(user.userId, req.tokenSid);
    return null;
  }

  /** 当前用户信息。 */
  @Get('profile')
  async profile(@CurrentUser() user: AuthUserContext, @Req() req: AuthenticatedRequest): Promise<unknown> {
    // 复用鉴权中间件已加载的上下文，避免重复 loadAuthUser
    return this.authService.getProfile(user.userId, req.authContext ?? null);
  }

  /** 当前用户菜单树（仅目录/菜单节点，按角色过滤）。 */
  @Get('menus')
  async menus(@CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.menuService.getMenusByRoles(user.roles);
  }

  /** 当前用户权限码列表。 */
  @Get('permissions')
  async permissions(@CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.authService.getPermissions(user.userId);
  }
}
