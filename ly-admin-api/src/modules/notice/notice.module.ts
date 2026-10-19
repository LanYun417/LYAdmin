/**
 * 站内通知模块。
 * 模块职责：发布通知与个人收件箱。导出 NoticeService 供 auth/monitor 等模块在关键操作后推送提醒。
 */
import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller.js';
import { NoticeService } from './notice.service.js';

@Module({
  controllers: [NoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
