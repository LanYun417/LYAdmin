import type { MenuNode } from '@/types/api';

/**
 * 菜单树前端缓存（短 TTL）。
 *
 * 菜单树在登录后基本不变，但会在「首次进入 / 路由守卫重试」等场景被拉取。
 * 用进程内缓存 + 短 TTL（默认 5 分钟），命中时直接复用，省去一次网络往返；
 * 配合 request 层的 ETag / 304 能力，后端一旦返回 ETag 还能进一步节省传输体积。
 *
 * 注意：仅缓存「当前会话、当前用户」的菜单。登出 / 重新登录时必须清空
 * （见 user store 的 {@link clearMenuCache} 调用点），否则可能把上一用户的菜单带过来。
 */

/** 缓存有效期：5 分钟。 */
const MENU_CACHE_TTL_MS = 5 * 60 * 1000;

interface MenuCacheEntry {
  data: MenuNode[];
  ts: number;
}

let entry: MenuCacheEntry | null = null;

/** 读取有效缓存；过期或不存在返回 null。 */
export function getMenuCache(): MenuNode[] | null {
  if (entry && Date.now() - entry.ts < MENU_CACHE_TTL_MS) {
    return entry.data;
  }
  entry = null;
  return null;
}

/** 写入缓存。 */
export function setMenuCache(data: MenuNode[]): void {
  entry = { data, ts: Date.now() };
}

/** 清空缓存（登出 / 重新登录时调用）。 */
export function clearMenuCache(): void {
  entry = null;
}
