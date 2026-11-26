/**
 * 多因素认证（TOTP）控制器。
 * 模块职责：绑定 / 解绑二次验证、恢复码管理（登录态下的自助操作）。
 *
 * 路由前缀 `mfa`：与「个人中心」语义一致，所有接口都基于当前登录用户，
 * 不接受路径参数指定他人——管理员也不能代管他人 MFA（密钥属于用户本人）。
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { MfaService } from './mfa.service.js';
import { MfaDisableDto, MfaEnableDto, MfaSetupDto } from './dto/mfa.dto.js';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  /** 当前 MFA 状态。 */
  @Get('status')
  status(@CurrentUser() user: { userId: number }): Promise<unknown> {
    return this.mfaService.getStatus(user.userId);
  }

  /** 开始绑定：返回种子与 otpauth URL（需登录口令）。 */
  @Post('setup')
  @OperationLog('安全中心', '绑定二次验证')
  async setup(@CurrentUser() user: { userId: number; username: string }, @Body() dto: MfaSetupDto): Promise<unknown> {
    return this.mfaService.setup(user.userId, user.username, dto.password);
  }

  /** 确认绑定：校验动态码后启用，返回一次性恢复码。 */
  @Post('enable')
  @OperationLog('安全中心', '启用二次验证')
  async enable(@CurrentUser() user: { userId: number }, @Body() dto: MfaEnableDto): Promise<unknown> {
    return this.mfaService.enable(user.userId, dto.code);
  }

  /** 解绑（需登录口令）。 */
  @Post('disable')
  @OperationLog('安全中心', '解绑二次验证')
  async disable(@CurrentUser() user: { userId: number }, @Body() dto: MfaDisableDto): Promise<null> {
    await this.mfaService.disable(user.userId, dto.password);
    return null;
  }

  /** 重新签发恢复码（需一次动态码校验，旧码作废）。 */
  @Put('recovery')
  @OperationLog('安全中心', '重签恢复码')
  async regenerateRecovery(@CurrentUser() user: { userId: number }, @Body() dto: MfaEnableDto): Promise<unknown> {
    return this.mfaService.regenerateRecovery(user.userId, dto.code);
  }
}
