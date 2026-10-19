/**
 * 在线用户模块。
 * 模块职责：装配会话列表与强制下线控制器（依赖 CommonModule 全局提供的会话/黑名单服务）。
 */
import { Module } from '@nestjs/common';
import { NoticeModule } from '../notice/notice.module.js';
import { MonitorController } from './monitor.controller.js';
import { MonitorService } from './monitor.service.js';

@Module({
  // 强退后要能给被下线的人发站内通知，故依赖 NoticeModule（它导出了 NoticeService）
  imports: [NoticeModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
