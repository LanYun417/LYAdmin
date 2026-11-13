/**
 * SSE 连接管理单测（jsdom 环境；EventSource 为 mock 替身）。
 * 覆盖：连接建立携带 token、事件分发与解析、假死重连、token 变更重连、
 *       未登录不连接、登出关闭、状态订阅。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSseForTest,
  closeSse,
  connectSse,
  notifyTokenChanged,
  onSseEvent,
  onSseStatusChange,
  SseEventName,
  sseStatus,
} from '@/utils/sse';
import { setAccessToken, removeToken } from '@/utils/auth';

/** mock EventSource：记录 URL 与 addEventListener 绑定，可手动触发事件。 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  url: string;
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Array<(raw: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (raw: MessageEvent) => void): void {
    (this.listeners.get(event) ?? this.listeners.set(event, []).get(event)!).push(handler);
  }

  removeEventListener(event: string, handler: (raw: MessageEvent) => void): void {
    const list = this.listeners.get(event);
    if (list) {
      const index = list.indexOf(handler);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** 测试辅助：触发一个事件帧。 */
  emit(event: string, data: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler({ data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent);
    }
  }

  /** 测试辅助：模拟浏览器自动重连后的新连接。 */
  static get last(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
  }
}

beforeEach(() => {
  setAccessToken('test-token-abc');
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  __resetSseForTest();
  removeToken();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SSE 连接管理', () => {
  it('连接 URL 带 token（EventSource 只能用 query 传令牌）', async () => {
    await connectSse();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.last.url).toContain('token=test-token-abc');
    expect(FakeEventSource.last.url).toContain('/api/sse/stream');
  });

  it('未登录不建连接', async () => {
    removeToken();
    await connectSse();
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(sseStatus()).toBe('closed');
  });

  it('重复 connect 不建第二条（幂等）', async () => {
    await connectSse();
    await connectSse();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('状态监听：open → closed', async () => {
    const statuses: string[] = [];
    onSseStatusChange((status) => statuses.push(status));

    await connectSse();
    FakeEventSource.last.onopen?.();
    expect(sseStatus()).toBe('open');

    closeSse();
    expect(sseStatus()).toBe('closed');
    expect(statuses).toContain('open');
    expect(statuses).toContain('closed');
  });

  it('事件分发：JSON data 自动解析后交给 handler', async () => {
    await connectSse();
    const received: unknown[] = [];
    onSseEvent(SseEventName.NOTICE, (data) => received.push(data));

    FakeEventSource.last.emit(SseEventName.NOTICE, { reason: 'published' });

    expect(received).toEqual([{ reason: 'published' }]);
  });

  it('非 JSON data 原样透传（不炸）', async () => {
    await connectSse();
    const received: unknown[] = [];
    onSseEvent(SseEventName.METRICS, (data) => received.push(data));

    FakeEventSource.last.emit(SseEventName.METRICS, 'not-json');

    expect(received).toEqual(['not-json']);
  });

  it('反注册后不再收到事件', async () => {
    await connectSse();
    const received: unknown[] = [];
    const off = onSseEvent(SseEventName.ONLINE, (data) => received.push(data));

    off();
    FakeEventSource.last.emit(SseEventName.ONLINE, { onlineUsers: 1 });

    expect(received).toEqual([]);
  });

  it('token 变更：旧连接关闭并用新 token 重建', async () => {
    await connectSse();
    const first = FakeEventSource.last;

    setAccessToken('new-token-xyz');
    notifyTokenChanged();

    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.last.url).toContain('token=new-token-xyz');
  });

  it('token 变更但无连接时是 no-op（不建连接）', () => {
    notifyTokenChanged();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('假死重连：超过阈值无任何字节 → 关闭并重建', async () => {
    vi.useFakeTimers();
    await connectSse();
    FakeEventSource.last.onopen?.();
    const first = FakeEventSource.last;

    // 90s 没有任何事件帧（连心跳都没有）：判定假死
    await vi.advanceTimersByTimeAsync(90_001);

    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('收到事件帧会重置假死计时（心跳足以保活）', async () => {
    vi.useFakeTimers();
    await connectSse();
    FakeEventSource.last.onopen?.();
    // 注册一个事件：心跳帧走具名事件通道（真实场景 bridge 注册了 notice/online）
    onSseEvent(SseEventName.ONLINE, () => undefined);

    // 每 80s 来一帧（低于 90s 阈值），持续 5 分钟
    for (let i = 0; i < 4; i += 1) {
      await vi.advanceTimersByTimeAsync(80_000);
      FakeEventSource.last.emit(SseEventName.ONLINE, {});
    }

    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
