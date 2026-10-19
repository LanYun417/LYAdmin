/**
 * 用户模块。
 * 模块职责：聚合用户 CRUD、状态、密码重置、角色分配接口。
 * PrismaService（全局 PrismaModule）与 CommonModule（含 DataScopeService / AuthCacheService）均全局，
 * 直接注入即可，无需在此 imports。
 */
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersImportService } from './users-import.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersImportService],
})
export class UsersModule {}
