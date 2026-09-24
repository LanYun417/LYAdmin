/**
 * 权限校验中间件。
 * 模块职责：校验当前用户是否具备所需权限码（按钮/接口级），超管直通。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SUPER_ADMIN_ROLE } from '@/constants';
import { AppError } from '@/utils/response';

/**
 * 生成权限校验中间件。
 * @param codes 允许访问的权限码（命中任一即通过）
 * @returns Express 中间件
 */
export function requirePermission(...codes: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const user = req.user;
      if (!user) {
        throw AppError.unauthorized();
      }
      // 超级管理员不受权限裁剪
      if (user.roles.includes(SUPER_ADMIN_ROLE)) {
        next();
        return;
      }
      // 未声明任何权限码视为配置缺失，按最小权限原则默认拒绝（fail-closed）。
      // 历史实现为 codes.length === 0 直接放行，一旦误写 requirePermission() 就会
      // 让所有已登录用户通过，属越权风险。
      if (codes.length === 0) {
        throw AppError.forbidden();
      }
      const passed = codes.some((code) => user.permissions.includes(code));
      if (!passed) {
        throw AppError.forbidden();
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
