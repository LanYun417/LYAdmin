/**
 * 数据导入控制器：上传入队 + 记录查询。
 * 导入为异步执行（队列消费），上传只返回受理信息。
 */
import { BadRequestException, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../common/auth/auth.guard.js';
import { OperationLog } from '../../../common/log/operation-log.decorator.js';
import { CSV_IMPORT_MULTER_OPTIONS } from '../../../common/file/upload.config.js';
import { ImportService } from './import.service.js';
import { ImportRecordQueryDto, ImportSubmitDto } from './import.dto.js';
import type { AuthUserContext } from '../../../common/types.js';

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /** 已注册的导入类型（前端下拉）。 */
  @Get('types')
  listTypes(): unknown {
    return this.importService.listTypes();
  }

  /** 上传并入队（立即返回，执行进度见导入记录）。 */
  @Post('submit')
  @OperationLog('数据导入', '上传')
  @UseInterceptors(FileInterceptor('file', CSV_IMPORT_MULTER_OPTIONS))
  submit(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() query: ImportSubmitDto,
    @CurrentUser() user: AuthUserContext,
  ): unknown {
    if (!file) {
      throw new BadRequestException('请选择要导入的文件');
    }
    return this.importService.submit(query.type, file, user.userId);
  }

  /** 导入记录分页。 */
  @Get('records')
  listRecords(@Query() query: ImportRecordQueryDto): unknown {
    return this.importService.listRecords(query as unknown as Record<string, unknown>);
  }
}
