/**
 * 静态资源鉴权中间件。
 * 模块职责：在静态服务链最前端完成令牌校验，未通过即短路 401（连文件都不必读）。
 * 迁移自原 Express 版本的 middlewares/auth.ts 的 `authenticateStatic`。
 *
 * 为何不用守卫：NestJS 的 APP_GUARD 只作用于控制器路由，
 * 而 `/static/*` 由 express.static 处理器直接出图，不经过控制器，故须用中间件兜。
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppException } from './app.exception.js';
import { JwtService } from './jwt.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { AuthUserService } from './auth-user.service.js';
import { authenticateRequest, type AuthenticatedRequest } from './auth.guard.js';

@Injectable()
export class StaticAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // authenticateRequest 已内置 `?token=` 回退（浏览器 img/avatar 无法带 Authorization 头）
      const { user, context } = await authenticateRequest(req, this.jwtService, this.blacklist, this.authUserService);
      const authReq = req as AuthenticatedRequest;
      authReq.user = user;
      authReq.authContext = context;
      next();
    } catch (error) {
      const status = error instanceof AppException ? error.getStatus() : 401;
      const code = error instanceof AppException ? error.code : 401;
      const message = error instanceof Error ? error.message : '未认证';
      res.status(status).json({ code, message, data: null });
    }
  }
}
