/**
 * 多因素认证（TOTP）模块。
 * 模块职责：绑定 / 解绑 / 恢复码管理；登录挑战的换令牌逻辑在 AuthService
 * （与登录流程的日志、设备控制强耦合），由 AuthModule 注入本模块的 MfaService。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [MfaController],
  providers: [MfaService],
  // 供 AuthModule 注入（登录挑战的签发与校验在 AuthService 内完成）
  exports: [MfaService],
})
export class MfaModule {}
