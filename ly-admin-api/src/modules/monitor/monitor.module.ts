/**
 * 监控管理模块。
 * 模块职责：在线会话（列表 / 强制下线）与系统资源指标（CPU / 内存 / 磁盘 / 负载）两组只读能力。
 * 依赖 CommonModule 全局提供的会话与黑名单服务；强退后要发站内通知，故引入 NoticeModule。
 */
import { Module } from '@nestjs/common';
import { NoticeModule } from '../notice/notice.module.js';
import { MonitorController } from './monitor.controller.js';
import { SystemMetricsController } from './system-metrics.controller.js';
import { MonitorService } from './monitor.service.js';
import { SystemMetricsService } from './system-metrics.service.js';

@Module({
  // 强退后要能给被下线的人发站内通知，故依赖 NoticeModule（它导出了 NoticeService）
  imports: [NoticeModule],
  controllers: [MonitorController, SystemMetricsController],
  providers: [MonitorService, SystemMetricsService],
})
export class MonitorModule {}
