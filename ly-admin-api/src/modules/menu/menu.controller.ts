/**
 * 菜单控制器。
 * 模块职责：菜单树查询与 CRUD 接口。
 * 迁移自原 Express 版本的 controllers/menu.controller.ts。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/operation-log.decorator.js';
import { RequirePermissions } from '../../common/permission.guard.js';
import { MenuService } from './menu.service.js';

/** 菜单新增/编辑入参。 */
export class MenuUpsertDto {
  parentId?: number;
  menuName!: string;
  menuType!: string;
  path?: string;
  component?: string;
  icon?: string;
  permission?: string;
  sort?: number;
  visible?: number;
  status?: number;
  redirect?: string;
  keepAlive?: number;
}

@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /** 菜单列表（tree=1 返回树）。 */
  @Get()
  @RequirePermissions('system:menu:list')
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.menuService.listMenus(query);
  }

  /** 全量菜单树（含按钮，供角色授权）。 */
  @Get('tree')
  @RequirePermissions('system:menu:list', 'system:role:list')
  tree(): Promise<unknown> {
    return this.menuService.getMenuTree();
  }

  /** 菜单详情。 */
  @Get(':id')
  @RequirePermissions('system:menu:query')
  detail(@Param('id') id: string): Promise<unknown> {
    return this.menuService.getMenuDetail(Number(id));
  }

  /** 创建菜单。 */
  @Post()
  @RequirePermissions('system:menu:add')
  @OperationLog('菜单管理', '新增')
  create(@Body() dto: MenuUpsertDto): Promise<unknown> {
    return this.menuService.createMenu(dto as unknown as Record<string, unknown>);
  }

  /** 更新菜单。 */
  @Put(':id')
  @RequirePermissions('system:menu:edit')
  @OperationLog('菜单管理', '编辑')
  update(@Param('id') id: string, @Body() dto: MenuUpsertDto): Promise<unknown> {
    return this.menuService.updateMenu(Number(id), dto as unknown as Record<string, unknown>);
  }

  /** 删除菜单。 */
  @Delete(':id')
  @RequirePermissions('system:menu:remove')
  @OperationLog('菜单管理', '删除')
  remove(@Param('id') id: string): Promise<void> {
    return this.menuService.deleteMenu(Number(id));
  }
}
