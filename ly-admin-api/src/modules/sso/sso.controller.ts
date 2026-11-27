/**
 * 企业单点登录（OIDC）控制器。
 * 模块职责：
 * - 登录面（公开）：提供方列表、授权地址、OIDC 回调、一次性票据换令牌；
 * - 管理面（需权限）：提供方 CRUD（含 clientSecret 信封加密，永不出库）。
 *
 * 说明：回调用 `@Res()` 直出 302（不经统一响应信封）——浏览器必须完成跳转，
 * 且令牌只以一次性 ticket 的形式出现在 URL 上。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { getClientIp } from '../../common/log/operation-log.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { config } from '../../common/config/config.js';
import { SsoService } from './sso.service.js';
import { SsoProviderDto, SsoRedeemDto } from './dto/sso.dto.js';
import type { AuthUserContext } from '../../common/types.js';

@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  /** 登录页可见的启用中提供方（公开）。 */
  @Public()
  @Get('providers')
  async providers(): Promise<unknown> {
    return this.ssoService.listEnabledProviders();
  }

  /** 取授权跳转地址（公开：前端拿到 URL 后自行 302）。 */
  @Public()
  @Get(':id/authorize')
  async authorize(@Param() params: IdParamDto): Promise<unknown> {
    return this.ssoService.buildAuthorizeUrl(params.id);
  }

  /**
   * OIDC 回调（公开）。
   * 换取一次性 ticket 后 302 到前端回调页；URL 上不出现正式令牌。
   */
  @Public()
  @Get('callback')
  async callback(
    @Res() res: Response,
    @Query('providerId') providerId: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
  ): Promise<void> {
    const frontend = config.sso.frontendUrl.replace(/\/+$/, '');
    const redirectTo = (params: Record<string, string>): void => {
      const target = new URL(`${frontend}/sso/callback`);
      for (const [key, value] of Object.entries(params)) {
        target.searchParams.set(key, value);
      }
      res.redirect(target.toString());
    };
    if (error) {
      redirectTo({ reason: `提供方拒绝授权：${error}` });
      return;
    }
    const providerIdNum = Number(providerId);
    if (!Number.isInteger(providerIdNum) || providerIdNum <= 0 || !code || !state) {
      redirectTo({ reason: '回调参数不全' });
      return;
    }
    try {
      const { ticket } = await this.ssoService.handleCallback(providerIdNum, code, state);
      redirectTo({ ticket });
    } catch (thrown) {
      const reason = thrown instanceof Error ? thrown.message : '登录失败';
      redirectTo({ reason });
    }
  }

  /** 前端用 ticket 换本站双 Token（公开）。 */
  @Public()
  @Post('redeem')
  async redeem(@Body() dto: SsoRedeemDto, @Req() req: Request): Promise<unknown> {
    const ip = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] ?? '');
    return this.ssoService.redeemTicket(dto.ticket, ip, userAgent);
  }

  /** 管理面：提供方列表（含完整配置，clientSecret 永不出库）。 */
  @Get('admin/providers')
  @RequirePermissions('system:sso:query')
  listProviders(@CurrentUser() _user: AuthUserContext): Promise<{ list: unknown[]; total: number }> {
    return this.ssoService.listProviders();
  }

  /** 管理面：提供方详情。 */
  @Get('admin/providers/:id')
  @RequirePermissions('system:sso:query')
  getProvider(@Param() params: IdParamDto): Promise<unknown> {
    return this.ssoService.getProvider(params.id);
  }

  /** 管理面：新增提供方。 */
  @Post('admin/providers')
  @OperationLog('SSO 配置', '新增')
  @RequirePermissions('system:sso:add')
  createProvider(@Body() dto: SsoProviderDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.ssoService.createProvider(dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 管理面：更新提供方（clientSecret 留空表示不修改）。 */
  @Put('admin/providers/:id')
  @OperationLog('SSO 配置', '编辑')
  @RequirePermissions('system:sso:edit')
  updateProvider(
    @Param() params: IdParamDto,
    @Body() dto: SsoProviderDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<unknown> {
    return this.ssoService.updateProvider(params.id, dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 管理面：删除提供方（绑定关系一并清理）。 */
  @Delete('admin/providers/:id')
  @OperationLog('SSO 配置', '删除')
  @RequirePermissions('system:sso:remove')
  async deleteProvider(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<null> {
    await this.ssoService.deleteProvider(params.id, user.userId);
    return null;
  }
}
