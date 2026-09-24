/**
 * 鉴权上下文进程内缓存。
 * 模块职责：为 `auth.service.loadAuthUser()` 提供进程内 TTL 缓存，避免**每个鉴权请求都查库**
 * （`User LEFT JOIN Role` + 可能的 `Menu JOIN Role`）。
 *
 * 设计要点：
 * - **TTL 30 秒**：仅作为兜底，过期后自动重新查库，避免缓存永久陈旧；
 * - **主动失效（关键，防越权）**：TTL 只是兜底，权限相关写操作必须**立即**调用
 *   `invalidateAuthCache()` 清除缓存，否则权限变更最多延迟一个 TTL 才生效（越权风险）。
 *   已覆盖的失效点（详见各服务调用处）：
 *   · 用户被禁用/启用、删除、角色变更（`user.service.ts`）；
 *   · 角色被修改/删除、角色菜单授权变更（`role.service.ts`）；
 *   · 菜单增删改（影响权限码集合，`menu.service.ts`）；
 *   · 改密（与现有 `passwordChangedAt` 旧 Token 失效语义对齐，`profile.service.ts`）。
 * - **惰性清理**：每 N 次读取清理一次过期键，并对容量设上限，避免 Map 无限增长
 *   （沿用 `middlewares/loginRateLimit.ts` 的 `sweepExpired` 惰性清理模式）。
 *
 * 局限（重要，勿误判为实现缺陷）：
 * - 进程内内存方案：**进程重启即清空**，且**多实例部署不共享**缓存；
 * - 集群化部署需改用 Redis 等共享存储（与 `loginRateLimit.ts` 的已知局限一致）。
 */
import type { AuthContext } from '@/services/auth.service';

/** 缓存 TTL（毫秒）：作为主动失效之外的最后兜底。 */
const AUTH_CACHE_TTL_MS = 30 * 1000;

/** 容量上限：异常情况下防止 Map 无限增长（超出时淘汰最早插入的条目）。 */
const AUTH_CACHE_MAX_ENTRIES = 5000;

/** 惰性清理调用间隔：每 N 次读取做一次过期键清理。 */
const SWEEP_INTERVAL = 500;

/** 缓存条目。 */
interface AuthCacheEntry {
  /** 已加载的鉴权上下文 */
  context: AuthContext;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
}

/** userId → 缓存条目。仅缓存「存在的用户」，不缓存 null（避免误伤缓存后新建的用户）。 */
const store = new Map<number, AuthCacheEntry>();

/** 自上次清理以来经过的读取次数。 */
let sinceSweep = 0;

/**
 * 清理已过期条目，防止 Map 无限增长。
 * @param now 当前时间戳（毫秒）
 */
function sweepExpired(now: number): void {
  store.forEach((entry, userId) => {
    if (entry.expiresAt <= now) {
      store.delete(userId);
    }
  });
}

/**
 * 读取缓存的鉴权上下文（未命中或已过期返回 null）。
 * @param userId 用户 id
 * @returns 命中的上下文；未命中返回 null
 */
export function getCachedAuthContext(userId: number): AuthContext | null {
  const now = Date.now();
  sinceSweep += 1;
  if (sinceSweep >= SWEEP_INTERVAL) {
    sinceSweep = 0;
    sweepExpired(now);
  }

  const entry = store.get(userId);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= now) {
    store.delete(userId);
    return null;
  }
  return entry.context;
}

/**
 * 写入鉴权上下文缓存。
 * @param userId 用户 id
 * @param context 鉴权上下文
 */
export function setCachedAuthContext(userId: number, context: AuthContext): void {
  // 容量保护：超限且为新键时，淘汰最早插入的条目（Map 保持插入顺序）
  if (!store.has(userId) && store.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) {
      store.delete(oldest.value);
    }
  }
  store.set(userId, { context, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

/**
 * 主动失效鉴权缓存。
 * @param userId 传用户 id 时仅失效该用户；不传时清空全部（角色/菜单级变更影响面广，需全清）
 */
export function invalidateAuthCache(userId?: number): void {
  if (userId === undefined) {
    store.clear();
    return;
  }
  store.delete(userId);
}
