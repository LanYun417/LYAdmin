/**
 * 认证模块。
 * 模块职责：聚合登录/刷新/登出/用户信息/菜单树/权限码接口。
 */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MenuModule } from '../menu/menu.module.js';
import { ConfigModule } from '../config/config.module.js';
import { NoticeModule } from '../notice/notice.module.js';

@Module({
  imports: [MenuModule, ConfigModule, NoticeModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
