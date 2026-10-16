/**
 * 鉴权上下文缓存（进程内，30s TTL）。
 * 模块职责：缓存「用户 → 角色码 + 权限码」，避免每个鉴权请求都查库。
 *
 * 为何需要缓存：`authenticate` 在每个请求上执行，若每次都查 `User → Role → Menu`
 * 三张表，高并发下会成为瓶颈。30s TTL 换性能，写操作时主动失效保证正确性。
 *
 * 失效点清单（改动权限相关数据时**必须**调用，否则权限变更最多延迟 30s 生效）：
 * - user.service：updateUser / deleteUser / updateStatus / resetPassword / assignRoles
 *   → `invalidateAuthCache(id)`（精确失效该用户）
 * - role.service：updateRole / deleteRole / assignMenus → `invalidateAuthCache()`（全清）
 * - menu.service：createMenu / updateMenu / deleteMenu → `invalidateAuthCache()`（全清）
 * - dept/dict/config：不参与鉴权码，不调用（靠 TTL 自然过期）
 *
 * 迁移自原 Express 版本的 services/authCache.ts。
 */
import { Injectable } from '@nestjs/common';
import type { AuthContext } from './types.js';

/** 缓存条目：值 + 过期时间戳。 */
interface CacheEntry {
  context: AuthContext;
  expiresAt: number;
}

/** TTL：30 秒。 */
const TTL_MS = 30_000;

/** 容量上限：超出后惰性清理，避免 Map 无限增长。 */
const MAX_ENTRIES = 5000;

@Injectable()
export class AuthCacheService {
  private readonly store = new Map<number, CacheEntry>();
  private readCount = 0;

  /** 读取缓存（命中且未过期时返回）。 */
  get(userId: number): AuthContext | null {
    this.readCount += 1;
    // 每 500 次读做一次惰性清理
    if (this.readCount % 500 === 0 && this.store.size > MAX_ENTRIES) {
      this.evictExpired();
    }
    const entry = this.store.get(userId);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(userId);
      return null;
    }
    return entry.context;
  }

  /** 写入缓存。 */
  set(userId: number, context: AuthContext): void {
    if (this.store.size >= MAX_ENTRIES) {
      this.evictExpired();
      // 仍超限则强制清空（宁可短暂多查库，也不无限增长）
      if (this.store.size >= MAX_ENTRIES) {
        this.store.clear();
      }
    }
    this.store.set(userId, { context, expiresAt: Date.now() + TTL_MS });
  }

  /**
   * 失效鉴权缓存。
   * @param userId 指定用户 id 时仅失效该用户；**省略则全清**。
   */
  invalidate(userId?: number): void {
    if (userId === undefined) {
      this.store.clear();
      return;
    }
    this.store.delete(userId);
  }

  /** 清理所有已过期条目。 */
  private evictExpired(): void {
    const now = Date.now();
    this.store.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        this.store.delete(key);
      }
    });
  }
}
