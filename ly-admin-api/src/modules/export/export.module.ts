/**
 * 导出中心模块（异步导出）。
 * 模块职责：创建导出任务 → 后台生成 CSV → 通知领取 → 下载/删除/清理。
 *
 * 依赖说明：
 * - LogsModule 导出 LogsService（同步导出的同一数据链路，导出后直接复用）；
 * - NoticeModule 导出 NoticeService（完成后站内通知 + SSE 实时推铃铛）。
 */
import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module.js';
import { NoticeModule } from '../notice/notice.module.js';
import { ExportTaskController } from './export-task.controller.js';
import { ExportTaskService } from './export-task.service.js';

@Module({
  imports: [LogsModule, NoticeModule],
  controllers: [ExportTaskController],
  providers: [ExportTaskService],
  // 导出 ExportTaskService 供 TaskModule 的清理任务注入
  exports: [ExportTaskService],
})
export class ExportModule {}
