/**
 * 仪表盘模块。
 * 模块职责：聚合统计卡片、登录趋势、操作分布、角色用户数接口。
 */
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
