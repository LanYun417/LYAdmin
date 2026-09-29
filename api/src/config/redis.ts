/**
 * Redis 客户端（单例）。
 * 模块职责：为「登出令牌黑名单」「登录频率限制」提供共享存储，以支持多实例部署与
 * 进程重启后的计数/黑名单延续（弥补此前进程内内存方案「重启清空 + 多实例不共享」的局限）。
 *
 * 降级策略（重要，务必理解）：Redis 不是硬依赖。
 * - 未配置 `REDIS_HOST` 时 `redis` 为 `null`，全部功能降级为「不生效」；
 * - 已配置但连接不可用（断连/重启）时，调用方通过 {@link isRedisReady} 跳过读操作、
 *   写操作静默失败，绝不因此阻塞登录或鉴权主流程（避免 Redis 故障引发全站不可用）。
 */
import Redis from 'ioredis';
import { config } from './index';

const { host, port, password, db } = config.redis;

/** 是否启用 Redis（仅当配置了 host 才视为启用）。 */
export const redisEnabled = Boolean(host);

/** 单例客户端；未启用时为 `null`。 */
export const redis: Redis | null = redisEnabled
  ? new Redis({
      host,
      port,
      password: password || undefined,
      db,
      // 控制单条命令在 Redis 不可达时的重试与超时，避免调用方长时间挂起
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      // 断连后指数退避重连（上限 2s），不影响进程启动
      retryStrategy: (times: number) => Math.min(times * 200, 2000),
    })
  : null;

if (redis) {
  redis.on('error', (err: Error) => {
    console.warn('[Redis] 连接异常，相关增强（登出黑名单/登录限流）已降级:', err.message);
  });
  console.log(`[Redis] 已启用（${host}:${port}/${db}），用于登出令牌黑名单与登录频率限制`);
} else {
  console.warn('[Redis] 未配置 REDIS_HOST，登出令牌黑名单与登录频率限制降级为关闭');
}

/**
 * 便捷判断：Redis 当前是否已连接就绪。
 * 调用方据此决定是否跳过读操作（避免在 Redis 断连时向离线队列压命令导致请求挂起）。
 */
export function isRedisReady(): boolean {
  return Boolean(redis && redis.status === 'ready');
}
