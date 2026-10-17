/**
 * RedisService：可选的共享存储客户端。
 * 模块职责：为「登出令牌黑名单 / 登录频率限制 / 验证码」提供共享存储能力。
 *
 * 设计原则（降级优先）：未配置 REDIS_HOST 时视为「不启用」，相关增强整体降级关闭，
 * 但**绝不阻断主流程**（登录与鉴权必须正常工作）。所有方法在 Redis 不可用时静默返回。
 */
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { config } from '../common/config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private ready = false;

  constructor() {
    if (!config.redis.host) {
      this.logger.warn('[Redis] 未配置 REDIS_HOST，登出黑名单 / 登录限流 / 验证码共享存储已降级关闭');
      return;
    }
    try {
      this.client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
        password: config.redis.password || undefined,
        database: config.redis.db,
      }) as RedisClientType;

      this.client.on('error', (err: unknown) => {
        // Redis 故障不应污染业务日志：降级为不可用状态即可
        this.ready = false;
        this.logger.warn(`[Redis] 连接异常，已降级: ${err instanceof Error ? err.message : String(err)}`);
      });
      this.client.on('ready', () => {
        this.ready = true;
        this.logger.log(`[Redis] 已连接 ${config.redis.host}:${config.redis.port}/${config.redis.db}`);
      });

      void this.client.connect().catch((err: unknown) => {
        this.ready = false;
        this.logger.warn(`[Redis] 连接失败，相关增强已降级: ${err instanceof Error ? err.message : String(err)}`);
      });
    } catch (err) {
      this.ready = false;
      this.logger.warn(`[Redis] 初始化失败，已降级: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Redis 是否可用。 */
  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  /** 写入键值并设置毫秒级过期时间。 */
  async set(key: string, value: string, ttlMs?: number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      const client = this.client!;
      if (ttlMs !== undefined) {
        await client.set(key, value, { PX: ttlMs });
      } else {
        await client.set(key, value);
      }
      return true;
    } catch {
      return false;
    }
  }

  /** 读取键值。 */
  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  /** 删除键。 */
  async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.del(key);
      return true;
    } catch {
      return false;
    }
  }

  /** 原子自增并设置首次过期时间（登录频率限制用）。 */
  async incrWithTtl(key: string, ttlMs: number): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }
    try {
      const client = this.client!;
      const value = await client.incr(key);
      if (value === 1) {
        // 首次计数时设置过期窗口，形成「固定窗口」限流
        await client.pExpire(key, ttlMs);
      }
      return value;
    } catch {
      return 0;
    }
  }

  /** 读取键的剩余毫秒过期时间；键不存在返回 -2。 */
  async pttl(key: string): Promise<number> {
    if (!this.isReady()) {
      return -2;
    }
    try {
      return await this.client!.pTTL(key);
    } catch {
      return -2;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // 关闭失败无需处理：进程即将退出
      }
    }
  }
}
