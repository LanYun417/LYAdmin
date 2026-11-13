/**
 * SSE 实时推送连接管理（浏览器 EventSource）。
 *
 * 设计要点：
 * - EventSource **只能带 query token**（无法设 Authorization 头），与后端
 *   `/sse/stream?token=` 约定对齐；token 从 userStore 现取（不缓存），
 *   刷新令牌后重连自然用上新 token；
 * - 断线自愈：EventSource 原生自动重连；另外监听 `sse-token-changed`
 *   自定义事件（无感刷新换 token 时派发）主动重连，避免旧 token 连上被 401；
 * - 心跳兜底：后端 25s 一个注释帧，前端 90s 没有**任何**字节即视为假死，
 *   手动 close 让浏览器重连（注释帧不走 onmessage，靠原始流监听）；
 * - 降级：连接失败（后端未起 / 网关拦 SSE）不抛错，页面功能退回轮询，
 *   由各使用方自行回退（监控页保留 autoRefresh 轮询兜底）。
 */
import { getAccessToken } from '@/utils/auth';

/** SSE 事件名（与后端 SseEvents 对齐）。 */
export const SseEventName = {
  CONNECTED: 'connected',
  NOTICE: 'notice',
  ONLINE: 'online',
  METRICS: 'metrics',
} as const;

/** 重连用的「token 已变更」事件名（userStore 无感刷新后派发）。 */
const TOKEN_CHANGED_EVENT = 'sse-token-changed';

/** 没有任何字节的假死判定阈值（后端心跳 25s，留 3 倍余量）。 */
const STALE_MS = 90_000;

export type SseStatus = 'connecting' | 'open' | 'closed';

/** 事件处理器表（按事件名注册）。 */
type Handlers = Partial<Record<string, (data: unknown) => void>>;

let source: EventSource | null = null;
let handlers: Handlers = {};
let statusListeners: Array<(status: SseStatus) => void> = [];
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;

/** 当前连接状态。 */
export function sseStatus(): SseStatus {
  if (connected) return 'open';
  return source ? 'connecting' : 'closed';
}

/** 订阅连接状态变化（用于右上角小圆点 / 调试）。 */
export function onSseStatusChange(listener: (status: SseStatus) => void): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((item) => item !== listener);
  };
}

function notifyStatus(): void {
  const current = sseStatus();
  for (const listener of statusListeners) {
    listener(current);
  }
}

/** 重置假死计时（收到任何字节 / 连接打开时调用）。 */
function resetStaleTimer(): void {
  if (staleTimer) {
    clearTimeout(staleTimer);
  }
  staleTimer = setTimeout(() => {
    // 假死：关闭让浏览器重连（EventSource 在 close 后不会自动重连，需重建）
    closeSse();
    void connectSse();
  }, STALE_MS);
}

/** 建立（或重建）SSE 连接。未登录时直接跳过。 */
export async function connectSse(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    return;
  }
  const token = getAccessToken();
  if (!token) {
    return;
  }
  if (source) {
    return;
  }

  const url = `/api/sse/stream?token=${encodeURIComponent(token)}`;
  source = new EventSource(url, { withCredentials: true });

  source.onopen = () => {
    connected = true;
    resetStaleTimer();
    notifyStatus();
  };

  source.onerror = () => {
    connected = false;
    // EventSource 会自动重连；这里只同步状态（真正放弃由 readyState 判定）
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      notifyStatus();
    }
  };

  // 已注册的事件逐个绑定
  for (const [event, handler] of Object.entries(handlers)) {
    if (handler) {
      bindEvent(event, handler);
    }
  }
  notifyStatus();
}

/** 已绑定到 source 的监听包装（反注册时按引用移除）。 */
const boundListeners = new Map<string, (raw: MessageEvent) => void>();

/** 给当前 source 绑定一个具名事件（同一事件名只绑一次，重复调用先移除旧的）。 */
function bindEvent(event: string, handler: (data: unknown) => void): void {
  const existing = boundListeners.get(event);
  if (existing) {
    source?.removeEventListener(event, existing);
  }
  const wrapper = (raw: MessageEvent): void => {
    // 任何事件帧都算「有字节」，重置假死计时
    resetStaleTimer();
    let data: unknown = raw.data;
    if (typeof raw.data === 'string') {
      try {
        data = JSON.parse(raw.data);
      } catch {
        // 非 JSON 原样透传（后端保证 JSON，这里只兜底）
      }
    }
    handler(data);
  };
  boundListeners.set(event, wrapper);
  source?.addEventListener(event, wrapper);
}

/** 关闭连接（登出 / token 失效时调用）。 */
export function closeSse(): void {
  boundListeners.clear();
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
  connected = false;
  source?.close();
  source = null;
  notifyStatus();
}

/**
 * 订阅一个 SSE 事件。
 * @param event 事件名（见 SseEventName）
 * @param handler 处理器
 * @returns 反注册函数
 */
export function onSseEvent(event: string, handler: (data: unknown) => void): () => void {
  handlers[event] = handler;
  bindEvent(event, handler);
  return () => {
    delete handlers[event];
    const wrapper = boundListeners.get(event);
    if (wrapper) {
      source?.removeEventListener(event, wrapper);
      boundListeners.delete(event);
    }
  };
}

/**
 * 通知 SSE 管理器「token 已变更」（无感刷新后由 userStore 调用）：
 * 断开旧连接并以新 token 重连——否则 EventSource 会一直用旧 token，
 * 服务端校验失败后反复 401 假死。
 */
export function notifyTokenChanged(): void {
  if (!source) {
    return;
  }
  closeSse();
  void connectSse();
}

if (typeof window !== 'undefined') {
  window.addEventListener(TOKEN_CHANGED_EVENT, () => notifyTokenChanged());
}

/** 测试辅助：重置模块状态（单测之间隔离用）。 */
export function __resetSseForTest(): void {
  handlers = {};
  statusListeners = [];
  boundListeners.clear();
  closeSse();
}
