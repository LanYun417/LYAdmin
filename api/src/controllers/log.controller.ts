/**
 * 日志控制器。
 * 模块职责：解析日志模块请求参数、调用服务、组装统一响应（含 CSV 导出）。
 */
import type { Request, Response } from 'express';
import * as logService from '@/services/log.service';
import { ok } from '@/utils/response';

/** 登录日志列表。 */
export async function loginLogs(req: Request, res: Response): Promise<void> {
  const result = await logService.listLoginLogs(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 操作日志列表。 */
export async function operationLogs(req: Request, res: Response): Promise<void> {
  const result = await logService.listOperationLogs(req.query as Record<string, unknown>);
  ok(res, result);
}

/** HTTP 访问日志列表。 */
export async function httpLogs(req: Request, res: Response): Promise<void> {
  const result = await logService.listHttpLogs(req.query as Record<string, unknown>);
  ok(res, result);
}

/**
 * 读取客户端时区偏移（前端每次请求携带 X-Timezone-Offset，
 * 值为浏览器 getTimezoneOffset() 的分钟数，如北京时间 -480）。
 */
function timezoneOffsetFrom(req: Request): number | undefined {
  const raw = req.get('x-timezone-offset');
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const offset = Number(raw);
  return Number.isFinite(offset) ? offset : undefined;
}

/** 清空所有 HTTP 访问日志。 */
export async function clearHttpLogs(_req: Request, res: Response): Promise<void> {
  await logService.clearHttpLogs();
  ok(res, null, '已清空所有 HTTP 日志');
}

/** 导出登录日志 CSV。 */
export async function exportLoginLogs(req: Request, res: Response): Promise<void> {
  const csv = await logService.exportLoginLogs(req.query as Record<string, unknown>, timezoneOffsetFrom(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="login-logs-${Date.now()}.csv"`);
  res.send(csv);
}

/** 导出操作日志 CSV。 */
export async function exportOperationLogs(req: Request, res: Response): Promise<void> {
  const csv = await logService.exportOperationLogs(req.query as Record<string, unknown>, timezoneOffsetFrom(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="operation-logs-${Date.now()}.csv"`);
  res.send(csv);
}
