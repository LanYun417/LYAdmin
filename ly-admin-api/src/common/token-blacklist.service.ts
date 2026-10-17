/**
 * 登出令牌黑名单（Redis 支撑）。
 * 模块职责：把「用户最近一次登出时间」写入 Redis，鉴权/刷新时据此判定令牌是否已失效——
 * 使「退出登录」真正服务端失效。
 *
 * 设计选择「按用户维度记录登出时间」而非逐令牌 `jti`：
 * - 登出即令该用户所有在登出时刻之前签发的令牌失效（覆盖多设备/多标签页）；
 * - 无需改动 JWT 结构（不引入 `jti`），后端鉴权链路改动最小；
 * - 判定式：`payload.iat * 1000 < 登出时间` → 失效（与 `passwordChangedAt` 检查同构）。
 *
 * 降级：Redis 不可用/未配置时，读返回「未失效」、写静默跳过，绝不阻断主流程。
 */
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service.js';

/** 黑名单键前缀（按用户维度）。 */
const LOGOUT_KEY_PREFIX = 'auth:logout:';

/**
 * 黑名单 TTL：覆盖 refresh(7d) 最大寿命后自然失效，避免键无限堆积。
 * 取值 8 天 > 7 天，留出余量。
 */
const LOGOUT_TTL_MS = 8 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenBlacklistService {
  constructor(private readonly redis: RedisService) {}

  /**
   * 记录用户登出时间（登出即令其旧令牌失效）。
   * 失败静默（降级：不影响接口返回）。
   */
  async recordLogout(userId: number): Promise<void> {
    await this.redis.set(`${LOGOUT_KEY_PREFIX}${userId}`, String(Date.now()), LOGOUT_TTL_MS);
  }

  /**
   * 判定令牌是否已被登出失效。
   *
   * @param userId 用户 ID
   * @param iat 令牌签发时间（秒，JWT 标准 claims）
   * @returns `true`=已失效（应拒绝）；Redis 不可用时返回 `false`（降级放行）
   */
  async isTokenRevoked(userId: number, iat: number): Promise<boolean> {
    const ts = await this.redis.get(`${LOGOUT_KEY_PREFIX}${userId}`);
    if (!ts) {
      return false;
    }
    return iat * 1000 <= Number(ts);
  }
}
