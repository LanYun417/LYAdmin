/**
 * 用户控制器。
 * 模块职责：解析请求参数、调用用户服务、组装统一响应（含写操作的自定义提示语）。
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AppException } from '../../common/exception/app.exception.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { CSV_IMPORT_MULTER_OPTIONS } from '../../common/file/upload.config.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import type { AuthUserContext } from '../../common/types.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { UsersService } from './users.service.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { IdsBodyDto } from '../../common/dto/ids-body.dto.js';
import type { BatchDeleteResult } from '../../common/utils/batch.js';
import { AssignRoleDto, CreateUserDto, ResetPasswordDto, StatusDto, UpdateUserDto } from './dto/users.dto.js';
import { UsersImportService, type ImportResult } from './users-import.service.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersImportService: UsersImportService,
  ) {}

  /** 分页列表（含数据权限过滤）。 */
  @Get()
  @RequirePermissions('system:user:list')
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.usersService.listUsers(query, user);
  }

  /**
   * 下载 CSV 导入模板。
   * 必须声明在 `@Get(':id')` **之前**：Nest 按声明顺序匹配，否则 `import/template` 会被 `:id` 吃掉。
   */
  @Get('import/template')
  @RequirePermissions('system:user:add')
  @RawResponse()
  downloadTemplate(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users-import-template.csv"');
    res.send(this.usersImportService.buildTemplateCsv());
  }

  /**
   * 批量导入用户（CSV，全成功或全不写）。
   * 行级校验失败返回 200 + 逐行报告（`data.failed`），请求级问题（空文件/缺列/超行数）才是 400。
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file', CSV_IMPORT_MULTER_OPTIONS))
  @RequirePermissions('system:user:add')
  @OperationLog('用户管理', '批量导入')
  async importUsers(@UploadedFile() file: Express.Multer.File | undefined): Promise<ResponseEnvelope<ImportResult>> {
    if (!file) {
      throw AppException.badRequest('未接收到文件');
    }
    // memoryStorage：文件在内存里，按 UTF-8 解码（Excel 导出为 GBK 时中文会乱码，
    // 提示用户"另存为 CSV UTF-8"比自动猜测编码更可靠）
    const result = await this.usersImportService.importUsers(file.buffer.toString('utf8'));
    return {
      __raw: true,
      data: result,
      message: result.created > 0 ? `成功导入 ${result.created} 条` : '校验未通过，未写入任何数据',
    };
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

  /**
   * 批量删除用户。
   * 复用单条删除的权限码（这是同一个能力，不该再拆一个权限出来）；
   * 返回明细而非「全成功/全失败」：批量里被超管保护或自身账号挡下的条目要能说清原因。
   */
  @Delete()
  @RequirePermissions('system:user:remove')
  @OperationLog('用户管理', '批量删除')
  async removeBatch(
    @Body() body: IdsBodyDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<BatchDeleteResult>> {
    const result = await this.usersService.batchDeleteUsers(body.ids, user.userId);
    return { __raw: true, data: result, message: `已删除 ${result.deleted} 条` };
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
