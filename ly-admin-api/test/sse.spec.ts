import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { SseService, SseEvents } from '../src/modules/sse/sse.service.js';
import { AppEvents, emit } from '../src/common/event/event-bus.js';

/** 假 SSE 响应流：记录写出的帧，可手动触发 close。 */
function fakeResponse(): Response & { frames: string[]; close: () => void } {
  const frames: string[] = [];
  const listeners: Record<string, Array<() => void>> = {};
  const res = {
    frames,
    writableEnded: false,
    destroyed: false,
    write(chunk: string): boolean {
      frames.push(chunk);
      return true;
    },
    on(event: string, listener: () => void): Response {
      (listeners[event] ??= []).push(listener);
      return res as unknown as Response;
    },
    close(): void {
      for (const listener of listeners.close ?? []) {
        listener();
      }
    },
  };
  return res as unknown as Response & { frames: string[]; close: () => void };
}

/** 采集某个事件名的帧体（解析 JSON）。 */
function framesOf(res: { frames: string[] }, event: string): unknown[] {
  return res.frames
    .filter((frame) => frame.startsWith(`event: ${event}\n`))
    .map((frame) => JSON.parse(frame.slice(frame.indexOf('data: ') + 6).trim()));
}

function createService(): SseService {
  return new SseService({ getSnapshot: vi.fn().mockResolvedValue({ cpu: { usage: 1 } }) } as never);
}

describe('SseService', () => {
  it('订阅后立即下发 connected 帧，携带在线用户数', () => {
    const service = createService();
    const res = fakeResponse();

    service.subscribe(1, res);
    service.subscribe(2, res);

    const connected = framesOf(res, SseEvents.CONNECTED);
    expect(connected).toEqual([{ onlineUsers: 1 }, { onlineUsers: 2 }]);
    expect(service.onlineUserCount()).toBe(2);
  });

  it('同一用户多连接：pushToUser 全部送达，onlineUserCount 仍按用户去重', () => {
    const service = createService();
    const a = fakeResponse();
    const b = fakeResponse();

    service.subscribe(7, a);
    service.subscribe(7, b);
    service.pushToUser(7, SseEvents.NOTICE, { reason: 'published' });

    expect(framesOf(a, SseEvents.NOTICE)).toEqual([{ reason: 'published' }]);
    expect(framesOf(b, SseEvents.NOTICE)).toEqual([{ reason: 'published' }]);
    expect(service.onlineUserCount()).toBe(1);
  });

  it('断开连接后清理：用户无连接即不在线（close 触发）', () => {
    const service = createService();
    const res = fakeResponse();

    service.subscribe(3, res);
    expect(service.onlineUserCount()).toBe(1);

    res.close();
    expect(service.onlineUserCount()).toBe(0);

    // 离线后推送静默无帧
    service.pushToUser(3, SseEvents.NOTICE, { reason: 'published' });
    expect(framesOf(res, SseEvents.NOTICE)).toEqual([]);
  });

  it('broadcast 送达全部在线连接', () => {
    const service = createService();
    const a = fakeResponse();
    const b = fakeResponse();

    service.subscribe(1, a);
    service.subscribe(2, b);
    service.broadcast(SseEvents.ONLINE, { onlineUsers: 2 });

    expect(framesOf(a, SseEvents.ONLINE)).toEqual([{ onlineUsers: 2 }]);
    expect(framesOf(b, SseEvents.ONLINE)).toEqual([{ onlineUsers: 2 }]);
  });

  it('通知发布事件 → 目标用户收到 notice 帧，其他人不受扰', () => {
    const service = createService();
    const a = fakeResponse();
    const b = fakeResponse();
    service.subscribe(1, a);
    service.subscribe(2, b);

    emit(AppEvents.NOTICE_PUBLISHED, { userIds: [1] });

    expect(framesOf(a, SseEvents.NOTICE)).toEqual([{ reason: 'published' }]);
    expect(framesOf(b, SseEvents.NOTICE)).toEqual([]);
  });

  it('会话创建/销毁事件 → 广播 online 帧', () => {
    const service = createService();
    const a = fakeResponse();
    service.subscribe(1, a);

    emit(AppEvents.SESSION_CREATED, { userId: 99 });
    emit(AppEvents.SESSION_DESTROYED, { userId: 99 });

    // 首帧 connected 之外，应有 2 帧 online（用户 99 上下线）
    const online = framesOf(a, SseEvents.ONLINE);
    expect(online).toHaveLength(2);
    expect(online[0]).toEqual({ onlineUsers: 1 });
  });

  it('metrics 订阅后推送采样；退订且无订阅者时停掉定时器', async () => {
    vi.useFakeTimers();
    try {
      const getSnapshot = vi.fn().mockResolvedValue({ cpu: { usage: 1 } });
      const service = new SseService({ getSnapshot } as never);
      const res = fakeResponse();
      service.subscribe(1, res);

      // 未订阅：即使时间流逝也不推 metrics
      await vi.advanceTimersByTimeAsync(3000);
      expect(framesOf(res, SseEvents.METRICS)).toEqual([]);
      expect(getSnapshot).not.toHaveBeenCalled();

      // 订阅后立即推一帧 + 按间隔续推
      service.setTopic(1, 'metrics', true);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3000);
      expect(framesOf(res, SseEvents.METRICS)).toHaveLength(2);

      // 退订：不再续推
      service.setTopic(1, 'metrics', false);
      const before = framesOf(res, SseEvents.METRICS).length;
      await vi.advanceTimersByTimeAsync(9000);
      expect(framesOf(res, SseEvents.METRICS)).toHaveLength(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('onModuleDestroy：清理监听与定时器，写帧不再抛错', () => {
    const service = createService();
    const res = fakeResponse();
    service.subscribe(1, res);

    service.onModuleDestroy();

    expect(service.onlineUserCount()).toBe(0);
    expect(() => service.broadcast(SseEvents.ONLINE, {})).not.toThrow();
  });
});
