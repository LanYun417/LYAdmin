/**
 * 仪表盘控制器。
 * 模块职责：解析仪表盘请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as dashboardService from '@/services/dashboard.service';
import { ok } from '@/utils/response';

/** 统计卡片。 */
export async function stats(_req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getStats();
  ok(res, result);
}

/** 登录趋势。 */
export async function loginTrend(req: Request, res: Response): Promise<void> {
  const days = Number(req.query.days ?? 7);
  const result = await dashboardService.getLoginTrend(days);
  ok(res, result);
}

/** 操作类型分布。 */
export async function operationDistribution(_req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getOperationDistribution();
  ok(res, result);
}

/** 各角色用户数。 */
export async function roleUserCount(_req: Request, res: Response): Promise<void> {
  const result = await dashboardService.getRoleUserCount();
  ok(res, result);
}
