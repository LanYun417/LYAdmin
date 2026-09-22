/**
 * 认证控制器。
 * 模块职责：解析请求参数、调用认证服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as authService from '@/services/auth.service';
import { getClientIp } from '@/utils/logger';
import { ok } from '@/utils/response';
import type { LoginInput, RefreshInput } from '@/validators/auth.validator';

/**
 * 登录。
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as LoginInput;
  const userAgent = String(req.headers['user-agent'] ?? '');
  const result = await authService.login(username, password, getClientIp(req), userAgent);
  ok(res, result, '登录成功');
}

/**
 * 刷新 Token。
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;
  const result = await authService.refresh(refreshToken);
  ok(res, result);
}

/**
 * 登出。
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  await authService.logout();
  ok(res, null, '退出登录成功');
}

/**
 * 当前用户信息。
 */
export async function profile(req: Request, res: Response): Promise<void> {
  const result = await authService.getProfile(req.user!.userId);
  ok(res, result);
}

/**
 * 当前用户菜单树。
 */
export async function menus(req: Request, res: Response): Promise<void> {
  const result = await authService.getUserMenus(req.user!.userId);
  ok(res, result);
}

/**
 * 当前用户权限码列表。
 */
export async function permissions(req: Request, res: Response): Promise<void> {
  const result = await authService.getPermissions(req.user!.userId);
  ok(res, result);
}
