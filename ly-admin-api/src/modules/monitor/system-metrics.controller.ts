/**
 * 系统资源监控控制器。
 * 模块职责：暴露 CPU / 内存 / 磁盘 / 负载 / 进程的一次性快照。
 *
 * 与在线用户控制器分开的原因：两组指标毫无关系，混在一个控制器里会让路由前缀
 * 互相干扰（`monitor/online` 下挂一个 `server` 端点，路径读起来像"某个会话的指标"）。
 */
import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { SystemMetricsService, type ServerMetrics } from './system-metrics.service.js';

@Controller('monitor')
export class SystemMetricsController {
  constructor(private readonly metricsService: SystemMetricsService) {}

  /**
   * 系统资源快照。
   *
   * 刻意**不记操作日志**：页面每几秒轮询一次，记日志只会把 sys_operation_log 灌满噪音，
   * 而"读指标"本身没有审计价值（真正需要留痕的是强退这类写操作）。
   */
  @Get('server')
  @RequirePermissions('monitor:server:list')
  server(): ServerMetrics {
    return this.metricsService.getSnapshot();
  }
}
