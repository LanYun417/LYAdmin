/**
 * CommonModule：全局共享基础设施。
 * 模块职责：把配置、Redis、JWT、验证码、鉴权缓存、鉴权用户查询、日志、文件等
 * 横切能力以全局模块形式导出，使业务模块无需逐个 import 即可注入。
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from './auth/jwt.service.js';
import { RedisService } from './redis/redis.service.js';
import { SessionService } from './auth/session.service.js';
import { TokenBlacklistService } from './auth/token-blacklist.service.js';
import { AuthCacheService } from './auth/auth-cache.service.js';
import { AuthUserService } from './auth/auth-user.service.js';
import { CaptchaService } from './auth/captcha.service.js';
import { DataScopeService } from './auth/data-scope.service.js';
import { LoginRateLimiterService } from './auth/login-rate-limit.service.js';
import { OperationLogService } from './log/operation-log.service.js';
import { FileLoggerService } from './log/file-logger.service.js';
import { HttpLogQueueService } from './log/http-log-queue.service.js';
import { FileService } from './file/file.service.js';
import { ImageScaleService, HotlinkGuardMiddleware, ImageScaleMiddleware } from './file/file-guards.js';
import { StaticAuthMiddleware } from './http/static-auth.middleware.js';
import { IpRegionService } from './ip/ip-region.service.js';

@Global()
@Module({
  providers: [
    RedisService,
    JwtService,
    TokenBlacklistService,
    SessionService,
    AuthCacheService,
    AuthUserService,
    CaptchaService,
    DataScopeService,
    LoginRateLimiterService,
    OperationLogService,
    FileLoggerService,
    HttpLogQueueService,
    FileService,
    ImageScaleService,
    IpRegionService,
    // 静态资源链的三个中间件：由 app.setup.ts 显式挂到 express 上，需要能被 app.get 解析
    StaticAuthMiddleware,
    HotlinkGuardMiddleware,
    ImageScaleMiddleware,
  ],
  exports: [
    RedisService,
    JwtService,
    TokenBlacklistService,
    SessionService,
    AuthCacheService,
    AuthUserService,
    CaptchaService,
    DataScopeService,
    LoginRateLimiterService,
    OperationLogService,
    FileLoggerService,
    HttpLogQueueService,
    FileService,
    ImageScaleService,
    IpRegionService,
  ],
})
export class CommonModule {}
