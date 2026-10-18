/**
 * 权限校验守卫与装饰器。
 * 模块职责：校验当前用户是否具备所需权限码（按钮/接口级），超管直通。
 */
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../exception/app.exception.js';
import { SUPER_ADMIN_ROLE } from '../config/constants.js';
import type { AuthUserContext } from '../types.js';

/** 权限码元数据键。 */
export const PERMISSION_KEY = 'ly:permission';

/**
 * 声明访问该接口所需的权限码（命中任一即通过）。
 *
 * 用法：`@RequirePermissions('system:user:list')`。
 */
export const RequirePermissions = (...codes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, codes);

/**
 * 权限校验守卫（APP_GUARD，需在 AuthGuard 之后执行）。
 *
 * 规则：
 * - 未声明 `@RequirePermissions` → 仅要求已登录（登录即可访问的接口依赖此行为）；
 * - 声明了权限码 → 命中任一即通过，超管直通；
 * - 声明了装饰器但**没给权限码**（`@RequirePermissions()` 误用）→ 按最小权限原则拒绝，
 *   避免「写漏参数即全员放行」。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const codes = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // 未声明权限码 → 不额外裁剪（鉴权由 AuthGuard 负责）
    if (!codes) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUserContext }>();
    const user = req.user;
    if (!user) {
      throw AppException.unauthorized();
    }
    // 超级管理员不受权限裁剪
    if (user.roles.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }
    // 声明了装饰器却未给出权限码：配置缺失，默认拒绝（fail-closed）
    if (codes.length === 0) {
      throw AppException.forbidden();
    }
    const passed = codes.some((code) => user.permissions.includes(code));
    if (!passed) {
      throw AppException.forbidden();
    }
    return true;
  }
}

/** 参数装饰器：读取客户端时区偏移（CSV 导出按用户时区格式化时间）。 */
export const TimezoneOffset = createParamDecorator((_data: unknown, context: ExecutionContext): number | undefined => {
  const req = context.switchToHttp().getRequest<Request>();
  const raw = req.headers['x-timezone-offset'];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
});
