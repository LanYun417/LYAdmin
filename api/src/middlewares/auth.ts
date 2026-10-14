/**
 * 鉴权中间件。
 * 模块职责：解析 Bearer Token、校验 accessToken、查库校验用户状态（强制下线）、
 * 校验改密后旧 Token 失效，并将用户上下文挂载到 `req.user`。
 */
import type { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ERROR_MESSAGE, Status } from '@/constants';
import { loadAuthUser } from '@/services/auth.service';
import { isTokenRevoked } from '@/services/tokenBlacklist';
import { AppError } from '@/utils/response';
import { verifyAccessToken } from '@/utils/jwt';
import type { JwtPayload } from '@/types';

/**
 * 强制鉴权：校验 Token 并加载用户权限上下文。
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthorized('未提供访问令牌');
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw AppError.unauthorized('未提供访问令牌');
    }

    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw AppError.unauthorized('登录已过期，请重新登录');
      }
      if (error instanceof JsonWebTokenError) {
        throw AppError.unauthorized('访问令牌无效');
      }
      throw error;
    }

    const context = await loadAuthUser(Number(payload.userId));
    if (!context) {
      throw AppError.unauthorized('用户不存在');
    }
    const { user, roleCodes, permissions } = context;

    // 强制下线：账号被禁用即失效
    if (Number(user.status) !== Status.ENABLED) {
      throw AppError.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }

    // 改密后旧 Token 失效（REQ-026）
    if (user.passwordChangedAt) {
      const changedAt = new Date(user.passwordChangedAt).getTime();
      if (payload.iat * 1000 < changedAt) {
        throw AppError.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
      }
    }

    // 登出后旧 Token 失效（Redis 黑名单：登出即令该用户旧令牌失效）
    if (await isTokenRevoked(Number(user.id), payload.iat)) {
      throw AppError.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
    }

    req.user = {
      userId: Number(user.id),
      username: user.username,
      roles: roleCodes,
      permissions,
      status: Number(user.status),
      deptId: Number(user.deptId ?? 0),
      deptName: user.dept?.deptName ?? null,
    };
    // 复用同一份上下文：控制器可读取 req.authContext，避免再次 loadAuthUser（B2）
    req.authContext = context;
    req.tokenIat = payload.iat;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 静态资源鉴权中间件（用于 `/static`）。
 *
 * 后端已对 `/static` 启用访问控制（仅登录用户可读取上传的文件）。但浏览器渲染
 * `<img>` / `<el-avatar>` / `<el-image>` 时**不会**自动附带 `Authorization` 头，
 * 因此前端在静态资源 URL 上拼接 `?token=<accessToken>` 查询参数；本中间件优先读取
 * `Authorization: Bearer` 头（API 直接请求场景），缺失时回退到 `req.query.token`，
 * 再复用 {@link authenticate} 完成令牌校验、用户状态与改密失效检查，并挂载 `req.user`。
 *
 * 顺序上本中间件位于 `hotlinkGuard` / 图片缩放 / `express.static` 之前：未通过鉴权即
 * 短路返回 401，连文件都不必读，也不浪费缩放算力。
 */
export async function authenticateStatic(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.headers.authorization && typeof req.query.token === 'string') {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authenticate(req, res, next);
}
