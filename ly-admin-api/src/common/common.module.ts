/**
 * CommonModule：全局共享基础设施。
 * 模块职责：把配置、Redis、JWT、验证码、鉴权缓存、鉴权用户查询、日志、文件等
 * 横切能力以全局模块形式导出，使业务模块无需逐个 import 即可注入。
 */
import { Global, Module } from '@nestjs/common';
import { JwtService } from './jwt.service.js';
import { RedisService } from './redis.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { AuthCacheService } from './auth-cache.service.js';
import { AuthUserService } from './auth-user.service.js';
import { CaptchaService } from './captcha.service.js';
import { DataScopeService } from './data-scope.service.js';
import { LoginRateLimiterService } from './login-rate-limit.service.js';
import { OperationLogService } from './operation-log.service.js';
import { FileLoggerService } from './file-logger.service.js';
import { HttpLogQueueService } from './http-log-queue.service.js';
import { FileService } from './file.service.js';
import { ImageScaleService } from './file-guards.js';

@Global()
@Module({
  providers: [
    RedisService,
    JwtService,
    TokenBlacklistService,
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
  ],
  exports: [
    RedisService,
    JwtService,
    TokenBlacklistService,
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
  ],
})
export class CommonModule {}
