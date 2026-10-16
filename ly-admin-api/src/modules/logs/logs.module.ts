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
})
export class LogsModule {}
