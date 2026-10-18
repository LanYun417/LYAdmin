/**
 * 接口限流中间件（按 IP 固定窗口，基于 Redis）。
 *
 * 为什么需要：原先只有登录接口有按账号的频率限制，验证码、公开文档等接口完全没有闸门，
 * 单机脚本即可把验证码接口刷爆（每个验证码都会写 Redis 并占内存）。
 *
 * 口径：
 * - 键为 `ratelimit:<ip>:<窗口序号>`，用 Redis 的 `INCR` + 首次 `PEXPIRE` 形成固定窗口
 *   （复用 RedisService.incrWithTtl，无需额外脚本，集群下天然共享计数）；
 * - **Redis 不可用时降级放行**（只打一条 warn）：与项目对 Redis 的整体降级策略一致，
 *   限流是防护而非业务前置条件，不能因为 Redis 抖动导致全站 429；
 * - 超限直接写 429 信封（与 StaticAuthMiddleware 写法一致）。不 `next(err)`：
 *   中间件抛出的错误不经过控制器异常过滤器，会退化成 Express 默认 500 页面；
 * - 跳过健康检查与根探活：探针是**高频**请求（编排系统每秒可打多次），
 *   把它们计入限流会自己把自己打成 429；
 * - 放在访问日志中间件**之后**注册：被限流的请求同样留在 `sys_http_log` 里，便于排查刷量来源。
 *
 * 阈值（单 IP / 单窗口）：
 * - 登录 20（已有按账号的 LoginRateLimiter，这里防的是「换账号爆破」）；
 * - 验证码 30（每次登录页加载都会取一次，留足余量）；
 * - 接口文档 120（公开接口，且响应体较大，防被反复拉取）；
 * - 其余接口取 `RATE_LIMIT_MAX`（默认 300）。
 */
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../config/constants.js';
import { RedisService } from '../redis/redis.service.js';

/** 不计入限流的路径（健康检查与根探活）。 */
const SKIP_PATTERNS: RegExp[] = [/^\/api\/health\//, /^\/api\/?$/];

/** 敏感接口的收紧阈值（按顺序匹配，命中即用）。 */
const SCOPE_LIMITS: Array<{ pattern: RegExp; max: number }> = [
  { pattern: /^\/api\/auth\/login/, max: 20 },
  { pattern: /^\/api\/auth\/captcha/, max: 30 },
  { pattern: /^\/api\/docs/, max: 120 },
];

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  /** Redis 降级提示只打一次，避免每请求刷日志。 */
  private degradedWarned = false;

  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const path = (req.originalUrl || req.url).split('?')[0] ?? '';
    if (SKIP_PATTERNS.some((pattern) => pattern.test(path))) {
      next();
      return;
    }

    const max = SCOPE_LIMITS.find((scope) => scope.pattern.test(path))?.max ?? config.rateLimit.max;
    const windowMs = config.rateLimit.windowMs;
    const ip = req.ip ?? 'unknown';
    const windowIndex = Math.floor(Date.now() / windowMs);
    const key = `ratelimit:${ip}:${windowIndex}`;

    const count = await this.redis.incrWithTtl(key, windowMs);
    if (count === 0) {
      // 0 = Redis 不可用（未配置 / 连接失败），降级放行
      if (!this.degradedWarned) {
        this.degradedWarned = true;
        this.logger.warn('[RateLimit] Redis 不可用，接口限流已降级放行（仅提示一次）');
      }
      next();
      return;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(max - count, 0)));

    if (count > max) {
      const ttlMs = await this.redis.pttl(key);
      if (ttlMs > 0) {
        res.setHeader('Retry-After', String(Math.ceil(ttlMs / 1000)));
      }
      res.status(ERROR_CODE.TOO_MANY_REQUESTS).json({
        code: ERROR_CODE.TOO_MANY_REQUESTS,
        message: ERROR_MESSAGE.TOO_MANY_REQUESTS,
        data: null,
      });
      return;
    }

    next();
  }
}
