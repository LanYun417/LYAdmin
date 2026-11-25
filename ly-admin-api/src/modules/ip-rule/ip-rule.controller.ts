/**
 * IP 访问控制规则控制器。
 * 模块职责：规则的增删改查、启停与命中计数清零。
 *
 * 权限码（需在菜单里授权给相应角色）：
 * - monitor:ipRule:list  查看规则列表
 * - monitor:ipRule:add   新增规则
 * - monitor:ipRule:edit  编辑 / 启停 / 清命中
 * - monitor:ipRule:remove 删除规则
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import type { AuthUserContext } from '../../common/types.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { IpRuleService } from './ip-rule.service.js';
import { CreateIpRuleDto, UpdateIpRuleDto } from './dto/ip-rule.dto.js';

@Controller('ip-rules')
export class IpRuleController {
  constructor(private readonly ipRuleService: IpRuleService) {}

  /** 规则分页列表。 */
  @Get()
  @RequirePermissions('monitor:ipRule:list')
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.ipRuleService.listRules(query);
  }

  /** 规则详情。 */
  @Get(':id')
  @RequirePermissions('monitor:ipRule:list')
  detail(@Param() params: IdParamDto): Promise<unknown> {
    return this.ipRuleService.getRule(params.id);
  }

  /** 新增规则。 */
  @Post()
  @RequirePermissions('monitor:ipRule:add')
  @OperationLog('IP 访问控制', '新增')
  async create(@Body() dto: CreateIpRuleDto, @CurrentUser() user: AuthUserContext): Promise<ResponseEnvelope<unknown>> {
    const data = await this.ipRuleService.createRule(dto, user.userId);
    return { __raw: true, data, message: '新增成功' };
  }

  /** 编辑规则（IP 不可改）。 */
  @Put(':id')
  @RequirePermissions('monitor:ipRule:edit')
  @OperationLog('IP 访问控制', '编辑')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateIpRuleDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.ipRuleService.updateRule(params.id, dto);
    return { __raw: true, data, message: '编辑成功' };
  }

  /** 启停规则。 */
  @Put(':id/status')
  @RequirePermissions('monitor:ipRule:edit')
  @OperationLog('IP 访问控制', '启停')
  async toggle(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.ipRuleService.toggleStatus(params.id);
    return { __raw: true, data, message: '操作成功' };
  }

  /** 清空命中计数。 */
  @Put(':id/hit-reset')
  @RequirePermissions('monitor:ipRule:edit')
  @OperationLog('IP 访问控制', '清零命中')
  async resetHit(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    await this.ipRuleService.clearHitCount(params.id);
    return { __raw: true, data: null, message: '已清零' };
  }

  /** 删除规则。 */
  @Delete(':id')
  @RequirePermissions('monitor:ipRule:remove')
  @OperationLog('IP 访问控制', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    await this.ipRuleService.deleteRule(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }
}
