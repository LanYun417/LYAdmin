/**
 * 菜单模块。
 * 模块职责：聚合菜单树查询与 CRUD 接口。
 */
import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';

@Module({
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
