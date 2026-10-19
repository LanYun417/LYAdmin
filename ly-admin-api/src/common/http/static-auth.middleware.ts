/**
 * 静态资源鉴权中间件。
 * 模块职责：在静态服务链最前端完成令牌校验，未通过即短路 401（连文件都不必读）。
 *
 * 为何不用守卫：NestJS 的 APP_GUARD 只作用于控制器路由，
 * 而 `/static/*` 由 express.static 处理器直接出图，不经过控制器，故须用中间件兜。
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppException } from '../exception/app.exception.js';
import { JwtService } from '../auth/jwt.service.js';
import { SessionService } from '../auth/session.service.js';
import { TokenBlacklistService } from '../auth/token-blacklist.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthUserService } from '../auth/auth-user.service.js';
import { authenticateRequest, type AuthenticatedRequest } from '../auth/auth.guard.js';

@Injectable()
export class StaticAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // authenticateRequest 已内置 `?token=` 回退（浏览器 img/avatar 无法带 Authorization 头）
      const { user, context } = await authenticateRequest(
        req,
        this.jwtService,
        this.blacklist,
        this.authUserService,
        this.sessionService,
        this.redis,
      );
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
