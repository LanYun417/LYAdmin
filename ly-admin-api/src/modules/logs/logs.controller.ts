/**
 * 日志控制器。
 * 模块职责：解析日志模块请求、调用服务、组装统一响应（含 CSV 导出，使用 @RawResponse 原样输出）。
 */
import { Body, Get, Delete, Controller, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions, TimezoneOffset } from '../../common/auth/permission.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { IdsBodyDto } from '../../common/dto/ids-body.dto.js';
import { LogsService } from './logs.service.js';

/** 删除结果文案：单条删除只说成功与否，批量删除回报实际命中条数。 */
function removedMessage(count: number, batch: boolean): string {
  if (batch) {
    return count > 0 ? `已删除 ${count} 条日志` : '没有可删除的日志';
  }
  return count > 0 ? '删除成功' : '日志不存在或已被删除';
}

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /** 登录日志列表。 */
  @Get('login')
  @RequirePermissions('log:login:list')
  listLoginLogs(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.logsService.listLoginLogs(query);
  }

  /** 批量删除登录日志（多选）。 */
  @Delete('login/batch')
  @RequirePermissions('log:login:remove')
  @OperationLog('日志管理', '批量删除登录日志')
  async removeLoginLogs(@Body() dto: IdsBodyDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteLoginLogs(dto.ids);
    return { __raw: true, data: null, message: removedMessage(count, true) };
  }

  /** 删除单条登录日志。 */
  @Delete('login/:id')
  @RequirePermissions('log:login:remove')
  @OperationLog('日志管理', '删除登录日志')
  async removeLoginLog(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteLoginLogs([params.id]);
    return { __raw: true, data: null, message: removedMessage(count, false) };
  }

  /** 操作日志列表。 */
  @Get('operation')
  @RequirePermissions('log:operation:list')
  listOperationLogs(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.logsService.listOperationLogs(query);
  }

  /** 批量删除操作日志（多选）。 */
  @Delete('operation/batch')
  @RequirePermissions('log:operation:remove')
  @OperationLog('日志管理', '批量删除操作日志')
  async removeOperationLogs(@Body() dto: IdsBodyDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteOperationLogs(dto.ids);
    return { __raw: true, data: null, message: removedMessage(count, true) };
  }

  /** 删除单条操作日志。 */
  @Delete('operation/:id')
  @RequirePermissions('log:operation:remove')
  @OperationLog('日志管理', '删除操作日志')
  async removeOperationLog(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteOperationLogs([params.id]);
    return { __raw: true, data: null, message: removedMessage(count, false) };
  }

  /** HTTP 访问日志列表。 */
  @Get('http')
  @RequirePermissions('log:http:list')
  listHttpLogs(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.logsService.listHttpLogs(query);
  }

  /** HTTP 日志详情（请求 / 响应体按需加载）。 */
  @Get('http/detail/:id')
  @RequirePermissions('log:http:list')
  getHttpLogDetail(@Param() params: IdParamDto): Promise<unknown> {
    return this.logsService.getHttpLogDetail(params.id);
  }

  /** 批量删除 HTTP 访问日志（多选）。 */
  @Delete('http/batch')
  @RequirePermissions('log:http:remove')
  @OperationLog('日志管理', '批量删除 HTTP 日志')
  async removeHttpLogs(@Body() dto: IdsBodyDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteHttpLogs(dto.ids);
    return { __raw: true, data: null, message: removedMessage(count, true) };
  }

  /** 删除单条 HTTP 访问日志。 */
  @Delete('http/:id')
  @RequirePermissions('log:http:remove')
  @OperationLog('日志管理', '删除 HTTP 日志')
  async removeHttpLog(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    const count = await this.logsService.deleteHttpLogs([params.id]);
    return { __raw: true, data: null, message: removedMessage(count, false) };
  }

  /** 清空所有 HTTP 访问日志（高危操作，独立权限码 log:http:clear）。 */
  @Delete('http')
  @RequirePermissions('log:http:clear')
  @OperationLog('日志管理', '清空 HTTP 日志')
  async clearHttpLogs(): Promise<{ __raw: true; data: null; message: string }> {
    await this.logsService.clearHttpLogs();
    return { __raw: true, data: null, message: '已清空所有 HTTP 日志' };
  }

  /** 导出登录日志 CSV。 */
  @Get('login/export')
  @RequirePermissions('log:login:export')
  @RawResponse()
  async exportLoginLogs(
    @Query() query: Record<string, unknown>,
    @TimezoneOffset() timezoneOffset: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.logsService.exportLoginLogs(query, timezoneOffset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="login-logs-${Date.now()}.csv"`);
    res.send(csv);
  }

  /** 导出操作日志 CSV。 */
  @Get('operation/export')
  @RequirePermissions('log:operation:export')
  @RawResponse()
  async exportOperationLogs(
    @Query() query: Record<string, unknown>,
    @TimezoneOffset() timezoneOffset: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.logsService.exportOperationLogs(query, timezoneOffset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="operation-logs-${Date.now()}.csv"`);
    res.send(csv);
  }

  /** 导出 HTTP 访问日志 CSV。 */
  @Get('http/export')
  @RequirePermissions('log:http:export')
  @RawResponse()
  async exportHttpLogs(
    @Query() query: Record<string, unknown>,
    @TimezoneOffset() timezoneOffset: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.logsService.exportHttpLogs(query, timezoneOffset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="http-logs-${Date.now()}.csv"`);
    res.send(csv);
  }
}
