/**
 * 鉴权与菜单缓存（进程内，30s TTL）。
 * 模块职责：
 * 1. 缓存「用户 → 角色码 + 权限码」，避免每个鉴权请求都查库；
 * 2. 缓存「角色组合 → 菜单树」，避免每次 `/auth/menus` 重复查菜单与关联表。
 *
 * 为何需要缓存：`authenticate` 在每个请求上执行，若每次都查 `User → Role → Menu`
 * 三张表，高并发下会成为瓶颈。30s TTL 换性能，写操作时主动失效保证正确性。
 *
 * 失效点清单（改动权限/菜单相关数据时**必须**调用，否则变更最多延迟 30s 生效）：
 * - user.service：updateUser / deleteUser / updateStatus / resetPassword / assignRoles
 *   → `invalidate(id)`（精确失效该用户）
 * - role.service：updateRole / deleteRole / assignMenus → `invalidate()`（全清）
 * - menu.service：createMenu / updateMenu / deleteMenu → `invalidate()`（全清）
 * - dept/dict/config：不参与鉴权码与菜单树，不调用（数据权限的部门缓存单独失效，见 DataScopeService）
 */
import { Injectable } from '@nestjs/common';
import type { AuthContext, MenuNode } from './types.js';

/** 缓存条目：值 + 过期时间戳。 */
interface CacheEntry {
  context: AuthContext;
  expiresAt: number;
}

/** 菜单树缓存条目。 */
interface MenuCacheEntry {
  tree: MenuNode[];
  expiresAt: number;
}

/** TTL：30 秒。 */
const TTL_MS = 30_000;

/** 容量上限：超出后惰性清理，避免 Map 无限增长。 */
const MAX_ENTRIES = 5000;

/** 菜单树缓存容量（角色组合数量有限，100 足够）。 */
const MAX_MENU_ENTRIES = 100;

@Injectable()
export class AuthCacheService {
  private readonly store = new Map<number, CacheEntry>();
  private readonly menuStore = new Map<string, MenuCacheEntry>();
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
   * 读取菜单树缓存。
   * @param key 角色组合键（超管为 `super`，其余为排序后的角色码用逗号拼接）
   */
  getMenuTree(key: string): MenuNode[] | null {
    const entry = this.menuStore.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.menuStore.delete(key);
      return null;
    }
    return entry.tree;
  }

  /** 写入菜单树缓存。 */
  setMenuTree(key: string, tree: MenuNode[]): void {
    if (this.menuStore.size >= MAX_MENU_ENTRIES) {
      const now = Date.now();
      this.menuStore.forEach((entry, entryKey) => {
        if (entry.expiresAt < now) {
          this.menuStore.delete(entryKey);
        }
      });
      if (this.menuStore.size >= MAX_MENU_ENTRIES) {
        this.menuStore.clear();
      }
    }
    this.menuStore.set(key, { tree, expiresAt: Date.now() + TTL_MS });
  }

  /**
   * 失效缓存。
   * @param userId 指定用户 id 时仅失效该用户的鉴权上下文；**省略则全清**（含菜单树）。
   */
  invalidate(userId?: number): void {
    if (userId === undefined) {
      this.store.clear();
      this.menuStore.clear();
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
