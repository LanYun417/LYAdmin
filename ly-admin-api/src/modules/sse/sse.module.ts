/**
 * SSE 实时推送模块。
 * 模块职责：SSE 连接管理 + 通知/上下线事件推送 + metrics 主题订阅。
 *
 * 依赖说明：
 * - MonitorModule 导出 SystemMetricsService（metrics 主题的采样来源）；
 * - JwtService / TokenBlacklistService / AuthUserService / SessionService / RedisService
 *   用于 stream 端点的手动鉴权（EventSource 带不了 Authorization 头）；
 *   这些由 CommonModule / PrismaModule 全局提供（与 AuthGuard 的依赖面一致）。
 */
import { Module } from '@nestjs/common';
import { MonitorModule } from '../monitor/monitor.module.js';
import { SseController } from './sse.controller.js';
import { SseService } from './sse.service.js';

@Module({
  imports: [MonitorModule],
  controllers: [SseController],
  providers: [SseService],
})
export class SseModule {}
