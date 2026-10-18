/**
 * 鉴权守卫与请求上下文装饰器。
 * 模块职责：解析 Bearer Token、校验 accessToken、查库校验用户状态（强制下线）、
 * 校验改密后旧 Token 失效与登出黑名单，并把用户上下文挂载到请求对象。
 */
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../exception/app.exception.js';
import { ERROR_MESSAGE, Status } from '../config/constants.js';
import { JwtService } from './jwt.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
// 必须为**值导入**（非 import type）：Nest 依赖注入需要运行时的构造函数引用，
// 用 import type 会在 emitDecoratorMetadata 下退化为 Function，导致无法解析依赖。
import { AuthUserService } from './auth-user.service.js';
import type { AuthContext, AuthUserContext } from '../types.js';

/** 请求对象扩展：挂载鉴权上下文。 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
  /** 已加载的完整鉴权上下文，供控制器复用避免重复查库 */
  authContext?: AuthContext | null;
  tokenIat?: number;
}

/** 公开接口标记：跳过鉴权。 */
export const IS_PUBLIC_KEY = 'ly:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** 读取请求中的 accessToken：优先 Authorization 头，回退 `?token=`（静态资源场景）。 */
export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      return token;
    }
  }
  // 浏览器 <img>/<el-avatar> 无法自动带 Authorization 头，故前端在静态资源 URL 上拼 ?token=
  const queryToken = (req.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }
  return null;
}

/**
 * 执行鉴权核心逻辑，返回用户上下文；失败抛 AppException。
 * 供守卫与静态资源中间件复用。
 */
export async function authenticateRequest(
  req: Request,
  jwtService: JwtService,
  blacklist: TokenBlacklistService,
  authUserService: AuthUserService,
): Promise<{ user: AuthUserContext; context: AuthContext | null }> {
  const token = extractToken(req);
  if (!token) {
    throw AppException.unauthorized('未提供访问令牌');
  }

  let payload;
  try {
    payload = await jwtService.verifyAccessToken(token);
  } catch (error) {
    if (jwtService.isExpiredError(error)) {
      throw AppException.unauthorized('登录已过期，请重新登录');
    }
    // jose 把「结构非法」「签名不符」等都归为 JWTInvalid / JWTClaimValidationFailed，
    // 统一按「令牌无效」处理，**不把内部错误细节透给客户端**。
    if (jwtService.isInvalidError(error)) {
      throw AppException.unauthorized('访问令牌无效');
    }
    // 兜底：任何其它解析异常同样按 401 处理（而非 500），避免泄露实现细节
    throw AppException.unauthorized('访问令牌无效');
  }

  const context = await authUserService.loadAuthUser(Number(payload.userId));
  if (!context) {
    throw AppException.unauthorized('用户不存在');
  }

  // 强制下线：账号被禁用即失效
  if (Number(context.status) !== Status.ENABLED) {
    throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
  }

  // 改密后旧 Token 失效
  if (context.passwordChangedAt) {
    const changedAt = new Date(context.passwordChangedAt).getTime();
    if (payload.iat * 1000 < changedAt) {
      throw AppException.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
    }
  }

  // 登出后旧 Token 失效（Redis 黑名单）
  if (await blacklist.isTokenRevoked(context.userId, payload.iat)) {
    throw AppException.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
  }

  const user: AuthUserContext = {
    userId: context.userId,
    username: context.username,
    roles: context.roleCodes,
    permissions: context.permissions,
    status: Number(context.status),
    deptId: Number(context.deptId ?? 0),
    deptName: context.deptName ?? null,
    tokenIat: payload.iat,
  };
  return { user, context };
}

/**
 * 全局鉴权守卫（APP_GUARD）。
 * 默认全部接口需鉴权，`@Public()` 显式放行（登录、验证码、健康检查、接口文档）。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user, context: authContext } = await authenticateRequest(
      req,
      this.jwtService,
      this.blacklist,
      this.authUserService,
    );
    req.user = user;
    req.tokenIat = user.tokenIat;
    req.authContext = authContext;
    return true;
  }
}

/** 参数装饰器：读取当前登录用户。 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUserContext => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.user) {
    throw AppException.unauthorized();
  }
  return req.user;
});

/** 参数装饰器：读取已加载的鉴权上下文（含角色码/权限码），供控制器复用避免重复查库。 */
export const ReqAuthContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.authContext ?? null;
});
