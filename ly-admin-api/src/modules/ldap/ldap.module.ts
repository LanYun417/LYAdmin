/**
 * LDAP 目录认证模块。
 * 模块职责：目录配置管理 + 登录链路回退认证 + 账号自动供给。
 * 供 AuthModule 注入（登录流程在本地口令失败后回退 LDAP）。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { LdapController } from './ldap.controller.js';
import { LdapService } from './ldap.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [LdapController],
  providers: [LdapService],
  exports: [LdapService],
})
export class LdapModule {}
