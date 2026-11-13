/**
 * SSE 实时推送服务。
 *
 * 能力（零新增依赖，Nest @Sse）：
 * - 连接管理：按 userId 分组（同一用户多标签页 / 多设备各一条连接）；
 * - 事件推送：通知（notice:published）、在线上下线（session:created/destroyed）；
 * - 主题订阅：监控指标（metrics）按需推送——只有监控页打开的用户才收，
 *   避免给全体在线用户每 3s 推一份系统采样；
 * - 心跳：25s 注释帧保活（SSE 标准做法，代理/网关不会因空闲断链）；
 * - 断线清理：res.on('close') 反注册，无连接时停掉 metrics 定时器。
 *
 * 多实例边界：连接表是进程内 Map。单实例部署（当前形态）下行为正确；
 * 水平扩展多实例时需把事件源换成 Redis pub/sub（event-bus 已为此分层，
 * 只需替换其实现，本服务与生产者代码不动）。
 */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
import { AppEvents, on } from '../../common/event/event-bus.js';
import { SystemMetricsService } from '../monitor/system-metrics.service.js';

/** 心跳间隔（毫秒）。 */
const HEARTBEAT_MS = 25_000;

/** metrics 推送间隔（毫秒）：与监控页原轮询节奏一致。 */
const METRICS_PUSH_MS = 3_000;

/** 单个连接的订阅主题。 */
interface SseConnection {
  res: Response;
  topics: Set<'metrics'>;
}

/** 推送事件名常量（前端 switch 用）。 */
export const SseEvents = {
  /** 连接建立（携带在线连接数，前端可自检） */
  CONNECTED: 'connected',
  /** 新通知 / 通知变化（前端刷新未读数） */
  NOTICE: 'notice',
  /** 在线会话变化（前端刷新在线用户列表） */
  ONLINE: 'online',
  /** 系统监控指标采样（订阅制） */
  METRICS: 'metrics',
} as const;

@Injectable()
export class SseService implements OnModuleDestroy {
  /** userId → 该用户的全部连接（多标签页 / 多设备）。 */
  private readonly connections = new Map<number, Set<SseConnection>>();

  /** 心跳定时器（有连接才存在）。 */
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  /** metrics 推送定时器（有订阅者才存在）。 */
  private metricsTimer: ReturnType<typeof setInterval> | null = null;

  /** event-bus 反注册函数（模块销毁时调用）。 */
  private readonly unsubscribers: Array<() => void> = [];

  constructor(private readonly metricsService: SystemMetricsService) {
    // 新通知 → 推给目标用户的前端铃铛
    this.unsubscribers.push(
      on(AppEvents.NOTICE_PUBLISHED, ({ userIds }) => {
        for (const userId of userIds) {
          this.pushToUser(userId, SseEvents.NOTICE, { reason: 'published' });
        }
      }),
    );
    // 会话上下线 → 广播在线数变化（在线用户页实时刷新）
    this.unsubscribers.push(on(AppEvents.SESSION_CREATED, () => this.broadcastOnline()));
    this.unsubscribers.push(on(AppEvents.SESSION_DESTROYED, () => this.broadcastOnline()));
  }

  /**
   * 注册一条连接（控制器 @Sse 建立流后调用）。
   * @param userId 连接所属用户
   * @param res SSE 响应流
   */
  subscribe(userId: number, res: Response): void {
    // @Sse 已设置好 SSE 响应头，这里只做业务状态管理
    let bucket = this.connections.get(userId);
    if (!bucket) {
      bucket = new Set();
      this.connections.set(userId, bucket);
    }
    const connection: SseConnection = { res, topics: new Set() };
    bucket.add(connection);
    this.startHeartbeat();

    res.on('close', () => {
      bucket?.delete(connection);
      if (bucket && bucket.size === 0) {
        this.connections.delete(userId);
      }
      // 所有用户都不再订阅 metrics 时停掉定时器
      if (!this.hasTopicSubscribers('metrics')) {
        this.stopMetricsTimer();
      }
    });

    // 首帧：告知连接成功与当前在线连接数（前端可据此判断链路健康）
    this.write(res, SseEvents.CONNECTED, { onlineUsers: this.onlineUserCount() });
  }

  /** 切换主题订阅（前端监控页挂载/卸载时调用）。 */
  setTopic(userId: number, topic: 'metrics', enabled: boolean): void {
    const bucket = this.connections.get(userId);
    if (!bucket) {
      return;
    }
    for (const connection of bucket) {
      if (enabled) {
        connection.topics.add(topic);
      } else {
        connection.topics.delete(topic);
      }
    }
    if (enabled) {
      this.startMetricsTimer();
    } else if (!this.hasTopicSubscribers(topic)) {
      this.stopMetricsTimer();
    }
  }

  /** 当前在线连接用户数（用户维度，不是连接维度）。 */
  onlineUserCount(): number {
    return this.connections.size;
  }

  /** 推给单个用户的全部连接。 */
  pushToUser(userId: number, event: string, data: unknown): void {
    const bucket = this.connections.get(userId);
    if (!bucket) {
      return;
    }
    for (const connection of bucket) {
      this.write(connection.res, event, data);
    }
  }

  /** 广播给全部在线连接。 */
  broadcast(event: string, data: unknown): void {
    for (const bucket of this.connections.values()) {
      for (const connection of bucket) {
        this.write(connection.res, event, data);
      }
    }
  }

  /** 在线数变化广播（携带用户数，前端可自行决定是否刷新列表）。 */
  private broadcastOnline(): void {
    this.broadcast(SseEvents.ONLINE, { onlineUsers: this.onlineUserCount() });
  }

  /** 向一条连接写一帧事件（event + data + 空行一次写出，保证分帧原子性）。 */
  private write(res: Response, event: string, data: unknown): void {
    try {
      if (res.writableEnded || res.destroyed) {
        return;
      }
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // 连接已断：write 抛错时静默（close 事件会完成清理），绝不影响其他连接
    }
  }

  /** 有连接的用户里是否存在订阅某主题的连接。 */
  private hasTopicSubscribers(topic: 'metrics'): boolean {
    for (const bucket of this.connections.values()) {
      for (const connection of bucket) {
        if (connection.topics.has(topic)) {
          return true;
        }
      }
    }
    return false;
  }

  private startHeartbeat(): void {
    if (this.heartbeat) {
      return;
    }
    this.heartbeat = setInterval(() => {
      for (const bucket of this.connections.values()) {
        for (const connection of bucket) {
          try {
            // 注释帧：不触发前端 onmessage，仅保活（SSE 标准心跳形式）
            connection.res.write(': ping\n\n');
          } catch {
            // 同上：清理交给 close
          }
        }
      }
    }, HEARTBEAT_MS);
  }

  private startMetricsTimer(): void {
    if (this.metricsTimer) {
      return;
    }
    // 立即推一帧，免得起订阅后干等一个间隔
    void this.pushMetrics();
    this.metricsTimer = setInterval(() => void this.pushMetrics(), METRICS_PUSH_MS);
  }

  private stopMetricsTimer(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }

  /** 采样系统指标推给订阅者（采样失败只跳过，不中断定时器）。 */
  private async pushMetrics(): Promise<void> {
    if (!this.hasTopicSubscribers('metrics')) {
      return;
    }
    try {
      const snapshot = await this.metricsService.getSnapshot();
      this.broadcast(SseEvents.METRICS, snapshot);
    } catch {
      // 采样失败：本周期跳过（下一周期自然重试）
    }
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.stopMetricsTimer();
    this.connections.clear();
  }
}
