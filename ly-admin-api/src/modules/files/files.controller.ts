/**
 * 文件控制器。
 * 模块职责：解析文件模块请求参数、调用服务、组装统一响应（含上传/删除的自定义提示语）。
 */
import { Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { AppException } from '../../common/exception/app.exception.js';
import type { AuthUserContext } from '../../common/types.js';
import { type ResponseEnvelope, RawResponse } from '../../common/http/response.interceptor.js';
import { UPLOAD_MULTER_OPTIONS } from '../../common/file/upload.config.js';
import { FilesService, type FileItem } from './files.service.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { CheckQueryDto, UploadBizDto } from './dto/files.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** 上传（单/多文件，兼容任意字段名）。 */
  @Post('upload')
  @UseInterceptors(AnyFilesInterceptor(UPLOAD_MULTER_OPTIONS))
  @RequirePermissions('file:upload')
  @OperationLog('文件管理', '上传')
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUserContext,
    @Body() biz: UploadBizDto,
  ): Promise<ResponseEnvelope<{ id: number; originName: string; fileUrl: string }[]>> {
    const result = await this.filesService.saveFiles(files ?? [], user.userId, {
      bizType: biz.bizType,
      bizId: biz.bizId,
    });
    return { __raw: true, data: result, message: '上传成功' };
  }

  /** 当前用户的上传配额使用情况（供前端展示「已用 / 上限」）。 */
  @Get('quota')
  @RequirePermissions('file:upload')
  quota(@CurrentUser() user: AuthUserContext): Promise<{ usedBytes: number; quotaBytes: number; unlimited: boolean }> {
    return this.filesService.getQuota(user.userId);
  }

  /** 秒传预检：按内容哈希查询库内是否已存在相同文件。 */
  @Get('check')
  @RequirePermissions('file:upload')
  async check(@Query() query: CheckQueryDto): Promise<{ exists: boolean; file: FileItem | null }> {
    const hash = (query.hash ?? '').toLowerCase();
    if (!hash) {
      throw AppException.badRequest('hash 非法，应为 SHA-256 十六进制（64 位）');
    }
    const file = await this.filesService.checkFileByHash(hash);
    return { exists: file !== null, file };
  }

  /** 文件列表。 */
  @Get()
  @RequirePermissions('file:list')
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.filesService.listFiles(query);
  }

  /** 文件类型选项（对库内已有文件去重，供筛选下拉使用）。 */
  @Get('types')
  @RequirePermissions('file:list')
  listTypes(): Promise<string[]> {
    return this.filesService.listFileTypes();
  }

  /** 上传人选项（对库内已有上传人去重并关联用户表）。 */
  @Get('uploaders')
  @RequirePermissions('file:list')
  listUploaders(): Promise<unknown> {
    return this.filesService.listFileUploaders();
  }

  /**
   * 下载文件：强制附件语义（Content-Disposition: attachment）。
   * 中文文件名由 Express 自动编码；CR/LF/引号已去除避免响应头注入。
   */
  @Get(':id/download')
  @RequirePermissions('file:download')
  @RawResponse()
  async download(@Param() params: IdParamDto, @Res() res: Response): Promise<void> {
    const file = await this.filesService.getFileForDownload(params.id);
    const safeName = file.originName.replace(/[\r\n"]/g, '').trim() || `file-${params.id}`;
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.download(file.absolutePath, safeName);
  }

  /** 删除文件。 */
  @Delete(':id')
  @RequirePermissions('file:remove')
  @OperationLog('文件管理', '删除')
  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<null>> {
    await this.filesService.deleteFile(params.id);
    return { __raw: true, data: null, message: '删除成功' };
  }
}
