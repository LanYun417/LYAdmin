/**
 * 告警中心控制器。
 * 模块职责：渠道 / 规则的配置管理（需权限）、测试发送、投递记录查询与重试。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { AlertService } from './alert.service.js';
import { AlertChannelDto, AlertRecordQueryDto, AlertRuleDto } from './dto/alert.dto.js';
import type { AuthUserContext } from '../../common/types.js';

@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  /** 渠道列表（敏感字段脱敏）。 */
  @Get('channels')
  listChannels(): Promise<unknown> {
    return this.alertService.listChannels();
  }

  /** 渠道详情（编辑回显；敏感字段脱敏）。 */
  @Get('channels/:id')
  async getChannel(@Param() params: IdParamDto): Promise<unknown> {
    return this.alertService.getChannel(params.id);
  }

  /** 新增渠道。 */
  @Post('channels')
  @OperationLog('告警中心', '新增渠道')
  createChannel(@Body() dto: AlertChannelDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.alertService.createChannel(dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 更新渠道（未提供的敏感字段保留原值）。 */
  @Put('channels/:id')
  @OperationLog('告警中心', '编辑渠道')
  updateChannel(
    @Param() params: IdParamDto,
    @Body() dto: AlertChannelDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<unknown> {
    return this.alertService.updateChannel(params.id, dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 删除渠道。 */
  @Delete('channels/:id')
  @OperationLog('告警中心', '删除渠道')
  async deleteChannel(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<null> {
    await this.alertService.deleteChannel(params.id, user.userId);
    return null;
  }

  /** 测试发送（立即向该渠道投一条测试告警并落库）。 */
  @Post('channels/:id/test')
  @OperationLog('告警中心', '测试发送')
  testChannel(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.alertService.testChannel(params.id, user.userId);
  }

  /** 规则列表。 */
  @Get('rules')
  listRules(): Promise<unknown> {
    return this.alertService.listRules();
  }

  /** 新增规则。 */
  @Post('rules')
  @OperationLog('告警中心', '新增规则')
  createRule(@Body() dto: AlertRuleDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.alertService.createRule(dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 更新规则。 */
  @Put('rules/:id')
  @OperationLog('告警中心', '编辑规则')
  updateRule(
    @Param() params: IdParamDto,
    @Body() dto: AlertRuleDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<unknown> {
    return this.alertService.updateRule(params.id, dto as unknown as Record<string, unknown>, user.userId);
  }

  /** 删除规则。 */
  @Delete('rules/:id')
  @OperationLog('告警中心', '删除规则')
  async deleteRule(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<null> {
    await this.alertService.deleteRule(params.id, user.userId);
    return null;
  }

  /** 投递记录分页列表。 */
  @Get('records')
  listRecords(@Query() query: AlertRecordQueryDto): Promise<unknown> {
    return this.alertService.listRecords(query as unknown as Record<string, unknown>);
  }

  /** 重投一条失败记录（原渠道集合）。 */
  @Post('records/:id/retry')
  @OperationLog('告警中心', '重试投递')
  retryRecord(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.alertService.retryRecord(params.id, user.userId);
  }
}
