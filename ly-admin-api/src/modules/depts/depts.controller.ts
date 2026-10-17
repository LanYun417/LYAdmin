/**
 * 部门控制器。
 * 模块职责：部门模块请求解析、调用服务、组装统一响应。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { OperationLog } from '../../common/operation-log.decorator.js';
import { RequirePermissions } from '../../common/permission.guard.js';
import type { ResponseEnvelope } from '../../common/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { DeptService } from './depts.service.js';
import { DeptUpsertDto } from './dto/dept.dto.js';

@Controller('depts')
export class DeptController {
  constructor(private readonly deptService: DeptService) {}

  /** 部门列表（tree=1 时返回树）。 */
  @Get()
  @RequirePermissions('system:dept:list')
  list(@Query() query: Record<string, unknown>) {
    return this.deptService.listDepts(query);
  }

  /** 完整部门树（上级选择）。 */
  @Get('tree')
  @RequirePermissions('system:dept:list')
  tree() {
    return this.deptService.getDeptTree();
  }

  /** 部门详情。 */
  @Get(':id')
  @RequirePermissions('system:dept:query')
  detail(@Param() params: IdParamDto) {
    return this.deptService.getDeptDetail(params.id);
  }

  /** 新增部门。 */
  @Post()
  @RequirePermissions('system:dept:add')
  @OperationLog('部门管理', '新增')
  create(@Body() dto: DeptUpsertDto): Promise<ResponseEnvelope<unknown>> {
    return this.deptService
      .createDept(dto)
      .then((dept) => ({ __raw: true, data: dept, message: '新增成功' }) as ResponseEnvelope<unknown>);
  }

  /** 编辑部门。 */
  @Put(':id')
  @RequirePermissions('system:dept:edit')
  @OperationLog('部门管理', '编辑')
  update(@Param() params: IdParamDto, @Body() dto: DeptUpsertDto): Promise<ResponseEnvelope<unknown>> {
    return this.deptService
      .updateDept(params.id, dto)
      .then((dept) => ({ __raw: true, data: dept, message: '编辑成功' }) as ResponseEnvelope<unknown>);
  }

  /** 删除部门。 */
  @Delete(':id')
  @RequirePermissions('system:dept:remove')
  @OperationLog('部门管理', '删除')
  remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    return this.deptService
      .deleteDept(params.id)
      .then(() => ({ __raw: true, data: null, message: '删除成功' }) as ResponseEnvelope<null>);
  }
}
