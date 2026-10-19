/**
 * 字典控制器。
 * 模块职责：解析字典模块请求参数、调用服务、组装统一响应。
 * 命名前缀 `type*` 对应字典类型、`item*` 对应字典项（同属 /api/dict 一个模块）。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { IdsBodyDto } from '../../common/dto/ids-body.dto.js';
import type { BatchDeleteResult } from '../../common/utils/batch.js';
import { DictService } from './dict.service.js';
import {
  CreateDictItemDto,
  CreateDictTypeDto,
  SetStatusDto,
  UpdateDictItemDto,
  UpdateDictTypeDto,
} from './dto/dict.dto.js';

@Controller('dict')
export class DictController {
  constructor(private readonly dictService: DictService) {}

  /* ------------------------------ 字典类型 ------------------------------ */

  /** 字典类型分页列表。 */
  @Get('types')
  @RequirePermissions('system:dict:list')
  listTypes(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.dictService.listDictTypes(query);
  }

  /** 新增字典类型。 */
  @Post('types')
  @RequirePermissions('system:dict:add')
  @OperationLog('字典管理', '新增')
  async createType(@Body() dto: CreateDictTypeDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.createDictType(dto);
    return { __raw: true, data, message: '新增成功' };
  }

  /** 编辑字典类型。 */
  @Put('types/:id')
  @RequirePermissions('system:dict:edit')
  @OperationLog('字典管理', '编辑')
  async updateType(@Param() params: IdParamDto, @Body() dto: UpdateDictTypeDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.updateDictType(params.id, dto);
    return { __raw: true, data, message: '编辑成功' };
  }

  /** 启用 / 禁用字典类型（写操作，复用 system:dict:edit）。 */
  @Put('types/:id/status')
  @RequirePermissions('system:dict:edit')
  @OperationLog('字典管理', '编辑')
  async setTypeStatus(@Param() params: IdParamDto, @Body() dto: SetStatusDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.setDictTypeStatus(params.id, dto.status);
    return { __raw: true, data, message: dto.status === 1 ? '已启用' : '已禁用' };
  }

  /** 删除字典类型（连带删除其下字典项）。 */
  @Delete('types/:id')
  @RequirePermissions('system:dict:remove')
  @OperationLog('字典管理', '删除')
  async removeType(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    await this.dictService.deleteDictType(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }

  /** 批量删除字典类型（连带删除各自字典项；逐条执行并返回被跳过明细）。 */
  @Delete('types')
  @RequirePermissions('system:dict:remove')
  @OperationLog('字典管理', '批量删除')
  async removeTypesBatch(@Body() body: IdsBodyDto): Promise<ResponseEnvelope<BatchDeleteResult>> {
    const result = await this.dictService.batchDeleteDictTypes(body.ids);
    return { __raw: true, data: result, message: `已删除 ${result.deleted} 条` };
  }

  /* ------------------------------ 字典项 ------------------------------ */

  /** 字典项分页列表（按 dictType 过滤）。 */
  @Get('items')
  @RequirePermissions('system:dict:list')
  listItems(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.dictService.listDictItems(query);
  }

  /** 新增字典项。 */
  @Post('items')
  @RequirePermissions('system:dict:add')
  @OperationLog('字典管理', '新增')
  async createItem(@Body() dto: CreateDictItemDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.createDictItem(dto);
    return { __raw: true, data, message: '新增成功' };
  }

  /** 编辑字典项。 */
  @Put('items/:id')
  @RequirePermissions('system:dict:edit')
  @OperationLog('字典管理', '编辑')
  async updateItem(@Param() params: IdParamDto, @Body() dto: UpdateDictItemDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.updateDictItem(params.id, dto);
    return { __raw: true, data, message: '编辑成功' };
  }

  /** 启用 / 禁用字典项（写操作，复用 system:dict:edit）。 */
  @Put('items/:id/status')
  @RequirePermissions('system:dict:edit')
  @OperationLog('字典管理', '编辑')
  async setItemStatus(@Param() params: IdParamDto, @Body() dto: SetStatusDto): Promise<ResponseEnvelope<unknown>> {
    const data = await this.dictService.setDictItemStatus(params.id, dto.status);
    return { __raw: true, data, message: dto.status === 1 ? '已启用' : '已禁用' };
  }

  /** 删除字典项。 */
  @Delete('items/:id')
  @RequirePermissions('system:dict:remove')
  @OperationLog('字典管理', '删除')
  async removeItem(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {
    await this.dictService.deleteDictItem(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }

  /** 批量删除字典项（逐条执行并返回被跳过明细）。 */
  @Delete('items')
  @RequirePermissions('system:dict:remove')
  @OperationLog('字典管理', '批量删除')
  async removeItemsBatch(@Body() body: IdsBodyDto): Promise<ResponseEnvelope<BatchDeleteResult>> {
    const result = await this.dictService.batchDeleteDictItems(body.ids);
    return { __raw: true, data: result, message: `已删除 ${result.deleted} 条` };
  }

  /* ------------------------------ 业务取数 ------------------------------ */

  /**
   * 按类型编码取启用中的字典项（标签 + 值）。
   * 仅需登录、不设权限码（与 /api/profile 的「自有资源豁免」同类处理）。
   */
  @Get('data/:dictType')
  data(@Param('dictType') dictType: string): Promise<unknown> {
    return this.dictService.getDictData(dictType);
  }
}
