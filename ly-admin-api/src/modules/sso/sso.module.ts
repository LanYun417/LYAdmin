/**
 * 企业单点登录（OIDC）模块。
 * 模块职责：提供方配置管理 + 登录跳转/回调/换票。
 * 换票复用 AuthModule 的令牌签发（issueTokensForUser），保持登录口径一致。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SsoController } from './sso.controller.js';
import { SsoService } from './sso.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}
