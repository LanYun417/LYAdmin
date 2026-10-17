/**
 * 用户控制器。
 * 模块职责：解析请求参数、调用用户服务、组装统一响应（含写操作的自定义提示语）。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/operation-log.decorator.js';
import { RequirePermissions } from '../../common/permission.guard.js';
import { CurrentUser } from '../../common/auth.guard.js';
import type { AuthUserContext } from '../../common/types.js';
import { type ResponseEnvelope } from '../../common/response.interceptor.js';
import { UsersService } from './users.service.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { AssignRoleDto, CreateUserDto, ResetPasswordDto, StatusDto, UpdateUserDto } from './dto/users.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** 分页列表（含数据权限过滤）。 */
  @Get()
  @RequirePermissions('system:user:list')
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.usersService.listUsers(query, user);
  }

  /** 用户详情。 */
  @Get(':id')
  @RequirePermissions('system:user:query')
  detail(@Param() params: IdParamDto): Promise<unknown> {
    return this.usersService.getUserDetail(params.id);
  }

  /** 新增用户。 */
  @Post()
  @RequirePermissions('system:user:add')
  @OperationLog('用户管理', '新增')
  async create(@Body() dto: CreateUserDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.usersService.createUser(dto);
    return { __raw: true, data, message: '新增成功' };
  }

  /** 编辑用户。 */
  @Put(':id')
  @RequirePermissions('system:user:edit')
  @OperationLog('用户管理', '编辑')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateUserDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.usersService.updateUser(params.id, dto);
    return { __raw: true, data, message: '编辑成功' };
  }

  /** 删除用户。 */
  @Delete(':id')
  @RequirePermissions('system:user:remove')
  @OperationLog('用户管理', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.usersService.deleteUser(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }

  /** 启用/禁用。 */
  @Put(':id/status')
  @RequirePermissions('system:user:edit')
  @OperationLog('用户管理', '状态变更')
  async changeStatus(@Param() params: IdParamDto, @Body() dto: StatusDto): Promise<ResponseEnvelope<null>> {
    await this.usersService.updateStatus(params.id, dto.status);
    return { __raw: true, data: null, message: '状态更新成功' };
  }

  /** 重置密码。 */
  @Put(':id/password')
  @RequirePermissions('system:user:resetPwd')
  @OperationLog('用户管理', '重置密码')
  async resetPassword(@Param() params: IdParamDto, @Body() dto: ResetPasswordDto): Promise<ResponseEnvelope<null>> {
    await this.usersService.resetPassword(params.id, dto.password);
    return { __raw: true, data: null, message: '密码重置成功' };
  }

  /** 分配角色。 */
  @Put(':id/roles')
  @RequirePermissions('system:user:assignRole')
  @OperationLog('用户管理', '分配角色')
  async assignRoles(@Param() params: IdParamDto, @Body() dto: AssignRoleDto): Promise<ResponseEnvelope<null>> {
    await this.usersService.assignRoles(params.id, dto.roleIds ?? []);
    return { __raw: true, data: null, message: '角色分配成功' };
  }
}
