/**
 * 定时任务模块。
 * 模块职责：提供定时任务的注册、调度、执行与执行记录查询。
 *
 * 依赖说明：
 * - ScheduleModule 已在 AppModule 里 `forRoot()`（全局模块），SchedulerRegistry 随处可注入；
 * - FileLoggerService / ImageScaleService 由 CommonModule（全局）提供；
 * - ExportModule 提供 ExportTaskService（导出文件清理任务）；ChunkUploadService 由 FilesModule（导出）。
 * - ChunkUploadService 由 FilesModule 提供（分片暂存清理任务需要）；
 * - PrismaService 由 PrismaModule（全局）提供。
 */
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller.js';
import { TaskService } from './task.service.js';
import { FilesModule } from '../files/files.module.js';
import { ExportModule } from '../export/export.module.js';

@Module({
  imports: [FilesModule, ExportModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
