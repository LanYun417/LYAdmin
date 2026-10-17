/**
 * 仪表盘控制器。
 * 模块职责：解析仪表盘请求参数、调用服务、返回数据（统一响应由全局拦截器包装）。
 *
 * 权限说明：四个接口均为「登录即可访问」，故不施加 `@RequirePermissions`（全局鉴权守卫仍生效）。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { LoginTrendQueryDto } from './dto/dashboard.dto.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** 统计卡片。 */
  @Get('stats')
  stats(): Promise<unknown> {
    return this.dashboardService.getStats();
  }

  /** 登录趋势。 */
  @Get('login-trend')
  loginTrend(@Query() query: LoginTrendQueryDto): Promise<unknown> {
    return this.dashboardService.getLoginTrend(query.days ?? 7);
  }

  /** 操作类型分布。 */
  @Get('operation-distribution')
  operationDistribution(): Promise<unknown> {
    return this.dashboardService.getOperationDistribution();
  }

  /** 各角色用户数。 */
  @Get('role-user-count')
  roleUserCount(): Promise<unknown> {
    return this.dashboardService.getRoleUserCount();
  }
}
