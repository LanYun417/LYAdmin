/**
 * 登录频率限制。
 * 模块职责：对登录接口做「连续失败 N 次 / 窗口期」锁定，防止口令爆破。
 * 迁移自原 Express 版本的 middlewares/loginRateLimit.ts。
 *
 * 策略：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429）；登录成功后清零。
 * 存储优先 Redis（跨实例共享），未配置时回退进程内 Map（单实例）。
 */
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from './app.exception.js';
import { RedisService } from './redis.service.js';

/** 窗口内允许的失败次数。 */
const MAX_FAILURES = 5;
/** 计数窗口（毫秒）。 */
const WINDOW_MS = 5 * 60 * 1000;
/** 锁定时长（毫秒）。 */
const LOCK_MS = 15 * 60 * 1000;

/** Redis 键前缀。 */
const REDIS_PREFIX = 'auth:login:fail:';
/** 锁定键前缀。 */
const LOCK_PREFIX = 'auth:login:locked:';

/** 进程内回退存储。 */
const memoryStore = new Map<string, { failures: number; expiresAt: number }>();
const memoryLock = new Map<string, number>();

/** 清理过期的进程内计数。 */
function cleanupMemory(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore) {
    if (value.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
  for (const [key, expiresAt] of memoryLock) {
    if (expiresAt < now) {
      memoryLock.delete(key);
    }
  }
}

@Injectable()
export class LoginRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  /** 取当前客户端标识（IP）。 */
  private clientKey(req: Request): string {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return ip;
  }

  /**
   * 检查该客户端是否处于锁定期；锁定中抛 429。
   */
  async assertNotLocked(req: Request): Promise<void> {
    const key = this.clientKey(req);

    if (this.redis.isReady()) {
      const locked = await this.redis.get(`${LOCK_PREFIX}${key}`);
      if (locked) {
        throw AppException.tooManyRequests(`登录失败次数过多，请 ${Math.ceil(LOCK_MS / 60000)} 分钟后再试`);
      }
      return;
    }

    cleanupMemory();
    const lockedUntil = memoryLock.get(key);
    if (lockedUntil && lockedUntil > Date.now()) {
      throw AppException.tooManyRequests(`登录失败次数过多，请 ${Math.ceil(LOCK_MS / 60000)} 分钟后再试`);
    }
  }

  /** 记录一次登录失败；达到阈值则锁定。 */
  async recordFailure(req: Request): Promise<void> {
    const key = this.clientKey(req);

    if (this.redis.isReady()) {
      const count = await this.redis.incrWithTtl(`${REDIS_PREFIX}${key}`, WINDOW_MS);
      if (count >= MAX_FAILURES) {
        await this.redis.set(`${LOCK_PREFIX}${key}`, '1', LOCK_MS);
      }
      return;
    }

    cleanupMemory();
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      memoryStore.set(key, { failures: 1, expiresAt: Date.now() + WINDOW_MS });
      return;
    }
    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) {
      memoryLock.set(key, Date.now() + LOCK_MS);
      memoryStore.delete(key);
    }
  }

  /** 登录成功后清零该客户端的计数与锁定。 */
  async clear(req: Request): Promise<void> {
    const key = this.clientKey(req);
    if (this.redis.isReady()) {
      await this.redis.del(`${REDIS_PREFIX}${key}`);
      await this.redis.del(`${LOCK_PREFIX}${key}`);
      return;
    }
    memoryStore.delete(key);
    memoryLock.delete(key);
  }
}
