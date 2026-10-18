/**
 * 系统参数控制器。
 * 模块职责：解析参数模块请求参数、调用服务、组装统一响应。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { ConfigService } from './config.service.js';
import { CreateConfigDto, UpdateConfigDto } from './dto/config.dto.js';

@Controller('configs')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /** 参数分页列表。 */
  @Get()
  @RequirePermissions('system:config:list')
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.configService.listConfigs(query);
  }

  /** 新增参数。 */
  @Post()
  @RequirePermissions('system:config:add')
  @OperationLog('参数管理', '新增')
  async create(@Body() dto: CreateConfigDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.configService.createConfig(dto);
    return { __raw: true, data, message: '新增成功' };
  }

  /**
   * 按键取参数值（业务取数，仅需登录、不设权限码）。
   */
  @Get('data/:configKey')
  data(@Param('configKey') configKey: string): Promise<unknown> {
    return this.configService.getConfigData(configKey);
  }

  /** 参数详情。 */
  @Get(':id')
  @RequirePermissions('system:config:query')
  detail(@Param() params: IdParamDto): Promise<unknown> {
    return this.configService.getConfigDetail(params.id);
  }

  /** 编辑参数（键名不可改）。 */
  @Put(':id')
  @RequirePermissions('system:config:edit')
  @OperationLog('参数管理', '编辑')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateConfigDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.configService.updateConfig(params.id, dto);
    return { __raw: true, data, message: '编辑成功' };
  }

  /** 删除参数（内置参数不可删除）。 */
  @Delete(':id')
  @RequirePermissions('system:config:remove')
  @OperationLog('参数管理', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    await this.configService.deleteConfig(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }
}
