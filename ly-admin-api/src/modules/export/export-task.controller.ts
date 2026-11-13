/**
 * 导出中心控制器（异步导出：创建任务 / 我的任务 / 下载 / 删除）。
 *
 * 权限模型：
 * - 创建：需要目标模块对应的导出权限（log:xxx:export）——与同步导出同一套权限码，
 *   不新增独立按钮权限；@RequirePermissions 拦「三者全无」的人，方法内再按模块细分；
 * - 下载 / 删除：本人，或超级管理员（运维可协助取件）。
 */
import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { AppException } from '../../common/exception/app.exception.js';
import { SUPER_ADMIN_ROLE } from '../../common/config/constants.js';
import type { AuthUserContext } from '../../common/types.js';
import { EXPORT_MODULES, ExportTaskService, type ExportModuleKey } from './export-task.service.js';
import { CreateExportTaskDto, ExportTaskIdParamDto, ExportTaskQueryDto } from './dto/export-task.dto.js';

@Controller('export-tasks')
export class ExportTaskController {
  constructor(private readonly exportTasks: ExportTaskService) {}

  /**
   * 创建导出任务（秒回；生成与通知在后台进行）。
   */
  @Post()
  @RequirePermissions('log:login:export', 'log:operation:export', 'log:http:export')
  @OperationLog('下载中心', '创建导出任务')
  async create(
    @Body() dto: CreateExportTaskDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<{ id: number; moduleLabel: string }> {
    const meta = EXPORT_MODULES[dto.module as ExportModuleKey];
    if (!meta) {
      throw AppException.badRequest(`不支持的导出模块: ${String(dto.module)}`);
    }
    // 模块细分：三类日志各有导出权限，互不通用（超管角色放行）
    const allowed = user.roles.includes(SUPER_ADMIN_ROLE) || user.permissions.includes(meta.permission);
    if (!allowed) {
      throw AppException.forbidden(`没有${meta.label}的导出权限`);
    }
    const item = await this.exportTasks.create(Number(user.userId), user.username ?? '', {
      module: dto.module as ExportModuleKey,
      query: dto.query ?? {},
      timezoneOffset: dto.timezoneOffset,
    });
    return { id: item.id, moduleLabel: item.moduleLabel };
  }

  /** 我的导出任务（分页）。 */
  @Get()
  @RequirePermissions('export:list')
  list(@Query() query: ExportTaskQueryDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.exportTasks.listMine(Number(user.userId), query as Record<string, unknown>);
  }

  /** 下载导出文件（res.download 底层 send 库，Range 断点续传天然支持）。 */
  @Get(':id/download')
  @RequirePermissions('export:list')
  @RawResponse()
  async download(
    @Param() params: ExportTaskIdParamDto,
    @CurrentUser() user: AuthUserContext,
    @Res() res: Response,
  ): Promise<void> {
    const isSuperAdmin = user.roles.includes(SUPER_ADMIN_ROLE);
    const { item, absPath } = await this.exportTasks.getForDownload(params.id, Number(user.userId), isSuperAdmin);
    res.download(absPath, item.fileName ?? `export-${item.id}.csv`);
  }

  /** 删除任务（记录与文件一并删除）。 */
  @Delete(':id')
  @RequirePermissions('export:list')
  @OperationLog('下载中心', '删除导出任务')
  async remove(
    @Param() params: ExportTaskIdParamDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<{ __raw: true; data: null; message: string }> {
    const isSuperAdmin = user.roles.includes(SUPER_ADMIN_ROLE);
    await this.exportTasks.remove(params.id, Number(user.userId), isSuperAdmin);
    return { __raw: true, data: null, message: '已删除' };
  }
}
