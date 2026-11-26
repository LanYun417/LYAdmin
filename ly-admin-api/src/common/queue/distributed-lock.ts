/**
 * 分布式锁（Redis SET NX PX + Lua 安全释放）。
 * 模块职责：多实例部署时保证「同一时刻只有一个实例执行特定段代码」。
 *
 * 设计要点：
 * - 获取：`SET key token NX PX ttl`——令牌即「谁拿的锁」，释放时校验，防止误删别人的锁；
 * - 释放：Lua 脚本比对 token 后 DEL，保证「比对 + 删除」原子性；
 * - 兜底：Redis 不可用时 acquire 返回 false 且调用方按「加锁失败」处理
 *   （宁可这轮不执行，也不能两个实例同时跑）；
 * - TTL 必须大于任务最长执行时间：执行慢于 TTL 会锁自动过期导致并发放行，
 *   调用方应通过 renew 续期（长任务）或把 TTL 设得足够大。
 */
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

/** 释放锁的 Lua 脚本：token 匹配才删除（原子）。 */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/** 默认锁 TTL（毫秒）：覆盖绝大多数短任务的执行时长。 */
const DEFAULT_TTL_MS = 30_000;

/** 锁句柄：release 用。 */
export interface LockHandle {
  key: string;
  token: string;
  ttlMs: number;
}

@Injectable()
export class DistributedLock {
  constructor(private readonly redis: RedisService) {}

  /**
   * 尝试获取锁。
   * @returns 成功返回句柄；失败（已被持有 / Redis 不可用）返回 null
   */
  async acquire(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<LockHandle | null> {
    const token = randomUUID();
    const ok = await this.redis.setNx(key, token, ttlMs);
    return ok ? { key, token, ttlMs } : null;
  }

  /** 释放锁（token 不匹配说明锁已过期并被他人重取，静默跳过）。 */
  async release(handle: LockHandle | null): Promise<void> {
    if (!handle) {
      return;
    }
    try {
      // node-redis 支持 evaluate；Redis 不可用时抛错，由调用方兜底
      await this.redis.evalLockRelease(handle.key, handle.token);
    } catch {
      // 释放失败仅意味着锁等 TTL 自然过期，不向上抛
    }
  }

  /**
   * 续期：任务执行时长接近 TTL 时调用（防止执行中被别的实例抢走锁）。
   * @returns 续期成功（仍是锁的持有者）true / false
   */
  async renew(handle: LockHandle, ttlMs: number = handle.ttlMs): Promise<boolean> {
    try {
      const renewed = await this.redis.renewLock(handle.key, handle.token, ttlMs);
      return renewed;
    } catch {
      return false;
    }
  }
}

/** 供 RedisService 参考的脚本文本（单测断言用）。 */
export const LOCK_RELEASE_SCRIPT = RELEASE_SCRIPT;
