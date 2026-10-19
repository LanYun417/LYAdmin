/**
 * 在线用户模块。
 * 模块职责：装配会话列表与强制下线控制器（依赖 CommonModule 全局提供的会话/黑名单服务）。
 */
import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller.js';
import { MonitorService } from './monitor.service.js';

@Module({
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
