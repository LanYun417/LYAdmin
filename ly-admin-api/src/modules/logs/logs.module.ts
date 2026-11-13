/**
 * 日志模块。
 * 模块职责：聚合登录/操作/HTTP 日志查询、清空与 CSV 导出接口。
 * PrismaService（全局 PrismaModule）已全局，直接注入即可。
 */
import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';

@Module({
  controllers: [LogsController],
  providers: [LogsService],
  // 导出 LogsService 供异步导出中心（ExportTaskService）复用同一套
  // 查询/游标分页/上限预检链路，保证同步与异步导出口径一致
  exports: [LogsService],
})
export class LogsModule {}
