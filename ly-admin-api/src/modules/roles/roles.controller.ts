/**
 * 角色控制器。
 * 模块职责：角色模块请求解析、调用服务、组装统一响应。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { IdsBodyDto } from '../../common/dto/ids-body.dto.js';
import type { BatchDeleteResult } from '../../common/utils/batch.js';
import { RoleService } from './roles.service.js';
import { AssignMenuDto, CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /** 角色分页列表。 */
  @Get()
  @RequirePermissions('system:role:list')
  list(@Query() query: Record<string, unknown>) {
    return this.roleService.listRoles(query);
  }

  /**
   * 全部角色下拉。
   * 使用独立权限码 system:role:all，而非复用只读的 system:role:list：
   * admin 角色刻意不授予 system:role:list，而本接口是给持 system:user:assignRole 的角色
   * 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码。
   */
  @Get('all')
  @RequirePermissions('system:role:all')
  all() {
    return this.roleService.listAllRoles();
  }

  /** 新增角色。 */
  @Post()
  @RequirePermissions('system:role:add')
  @OperationLog('角色管理', '新增')
  create(@Body() dto: CreateRoleDto): Promise<ResponseEnvelope<unknown>> {
    return this.roleService
      .createRole(dto)
      .then((role) => ({ __raw: true, data: role, message: '新增成功' }) as ResponseEnvelope<unknown>);
  }

  /** 编辑角色。 */
  @Put(':id')
  @RequirePermissions('system:role:edit')
  @OperationLog('角色管理', '编辑')
  update(@Param() params: IdParamDto, @Body() dto: UpdateRoleDto): Promise<ResponseEnvelope<unknown>> {
    return this.roleService
      .updateRole(params.id, dto)
      .then((role) => ({ __raw: true, data: role, message: '编辑成功' }) as ResponseEnvelope<unknown>);
  }

  /** 删除角色。 */
  @Delete(':id')
  @RequirePermissions('system:role:remove')
  @OperationLog('角色管理', '删除')
  remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    return this.roleService
      .deleteRole(params.id)
      .then(() => ({ __raw: true, data: null, message: '删除成功' }) as ResponseEnvelope<null>);
  }

  /** 批量删除角色（复用单条删除的权限码；逐条执行并返回被跳过明细）。 */
  @Delete()
  @RequirePermissions('system:role:remove')
  @OperationLog('角色管理', '批量删除')
  async removeBatch(@Body() body: IdsBodyDto): Promise<ResponseEnvelope<BatchDeleteResult>> {
    const result = await this.roleService.batchDeleteRoles(body.ids);
    return { __raw: true, data: result, message: `已删除 ${result.deleted} 条` };
  }

  /** 角色已授权菜单 id。 */
  @Get(':id/menus')
  @RequirePermissions('system:role:query')
  menus(@Param() params: IdParamDto) {
    return this.roleService.getRoleMenuIds(params.id);
  }

  /** 授权角色菜单。 */
  @Put(':id/menus')
  @RequirePermissions('system:role:assignMenu')
  @OperationLog('角色管理', '授权菜单')
  assignMenus(@Param() params: IdParamDto, @Body() dto: AssignMenuDto): Promise<ResponseEnvelope<null>> {
    return this.roleService
      .assignMenus(params.id, dto.menuIds ?? [])
      .then(() => ({ __raw: true, data: null, message: '授权成功' }) as ResponseEnvelope<null>);
  }
}
