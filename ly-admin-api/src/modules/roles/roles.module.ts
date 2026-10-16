/**
 * 角色模块。
 * 模块职责：聚合角色 CRUD、下拉、菜单授权接口。
 */
import { Module } from '@nestjs/common';
import { RoleController } from './roles.controller.js';
import { RoleService } from './roles.service.js';

@Module({
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
