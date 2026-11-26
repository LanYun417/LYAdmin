/**
 * 数据导入模块。
 * 模块职责：上传入队 + 队列执行 + 记录与通知。
 * 依赖 QueueModule（入队/消费）、NoticeModule（完成通知）。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module.js';
import { QueueModule } from '../queue.module.js';
import { NoticeModule } from '../../../modules/notice/notice.module.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

@Module({
  imports: [PrismaModule, QueueModule, NoticeModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
