/**
 * 菜单控制器。
 * 模块职责：菜单树查询与 CRUD 接口。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { MenuService } from './menu.service.js';
import { MenuUpsertDto } from './dto/menu.dto.js';

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
  detail(@Param() params: IdParamDto): Promise<unknown> {
    return this.menuService.getMenuDetail(params.id);
  }

  /** 创建菜单。 */
  @Post()
  @RequirePermissions('system:menu:add')
  @OperationLog('菜单管理', '新增')
  create(@Body() dto: MenuUpsertDto): Promise<unknown> {
    return this.menuService.createMenu(dto);
  }

  /** 更新菜单。 */
  @Put(':id')
  @RequirePermissions('system:menu:edit')
  @OperationLog('菜单管理', '编辑')
  update(@Param() params: IdParamDto, @Body() dto: MenuUpsertDto): Promise<unknown> {
    return this.menuService.updateMenu(params.id, dto);
  }

  /** 删除菜单。 */
  @Delete(':id')
  @RequirePermissions('system:menu:remove')
  @OperationLog('菜单管理', '删除')
  remove(@Param() params: IdParamDto): Promise<void> {
    return this.menuService.deleteMenu(params.id);
  }
}
