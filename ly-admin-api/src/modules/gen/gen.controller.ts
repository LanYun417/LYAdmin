/**
 * 代码生成控制器。
 * 模块职责：接收代码生成请求、调用服务、返回统一响应或 ZIP 二进制流。
 *
 * 权限严格分离：list / preview / download / create 使用四个独立权限码，
 * 只读角色一律不授予 preview / download / create，避免越权导出、下载或写入源码。
 */
import { Controller, Get, Param, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { GenService } from './gen.service.js';
import { GenWriter } from './gen.writer.js';
import type { GenTableDetail, GenTableItem } from './gen.service.js';
import type { GenCreateResult } from './gen.writer.js';
import { GenConfigDto, GenCreateDto } from './dto/gen.dto.js';

/** 预览结果。 */
interface GenPreviewResult {
  tableName: string;
  files: Array<{ path: string; content: string }>;
}

@Controller('gen')
export class GenController {
  constructor(
    private readonly genService: GenService,
    private readonly genWriter: GenWriter,
  ) {}

  /** 列出全部业务表（读 information_schema.TABLES）。 */
  @Get('tables')
  @RequirePermissions('tool:gen:list')
  listTables(): Promise<GenTableItem[]> {
    return this.genService.listTables();
  }

  /** 指定表的字段结构详情。 */
  @Get('tables/:tableName')
  @RequirePermissions('tool:gen:list')
  tableDetail(@Param('tableName') tableName: string): Promise<GenTableDetail> {
    return this.genService.getGenTableDetail(tableName);
  }

  /** 在线预览生成的代码（返回文件列表）。 */
  @Post('preview')
  @RequirePermissions('tool:gen:preview')
  preview(@Body() config: GenConfigDto): Promise<GenPreviewResult> {
    return this.genService.previewGenCode(config);
  }

  /** 生成并下载代码（ZIP 二进制流）。 */
  @Post('download')
  @RequirePermissions('tool:gen:download')
  @RawResponse()
  async download(@Body() config: GenConfigDto, @Res() res: Response): Promise<void> {
    const { filename, buffer } = await this.genService.buildGenZip(config);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  /** 生成代码并直接写入项目目录（含自动接线）。 */
  @Post('create')
  @RequirePermissions('tool:gen:create')
  @OperationLog('代码生成', '写入项目')
  create(@Body() body: GenCreateDto): Promise<GenCreateResult> {
    return this.genWriter.createGenCode(body, body.overwrite === true);
  }
}
