/**
 * 告警中心模块。
 * 模块职责：聚合渠道 / 规则配置管理与事件分发引擎。
 * 供其它业务模块注入 AlertService（如导出失败、任务失败发布告警）。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AlertController } from './alert.controller.js';
import { AlertService } from './alert.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
