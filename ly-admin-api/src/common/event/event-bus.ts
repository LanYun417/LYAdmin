/**
 * 进程内事件总线（Node EventEmitter 薄封装，零新增依赖）。
 *
 * 解决什么问题：SSE 推送的触发源分散在 NoticeService（modules）、SessionService（common），
 * 而消费者是 SseService（modules/sse）。直接互相 import 会立刻出现循环依赖
 * （notice → sse → notice）或让基础层反向依赖业务层。事件总线把三方解耦：
 * 生产者只 emit，消费者只 listen，互不知道对方存在。
 *
 * 边界：仅限**单实例部署**（多实例水平扩展时需换成 Redis pub/sub，
 * 届时只改本文件实现，生产者/消费者不动）。
 */
import { EventEmitter } from 'node:events';

/** 事件名常量：集中定义，避免散落字符串拼错。 */
export const AppEvents = {
  /** 通知已发布：{ userIds: number[] } */
  NOTICE_PUBLISHED: 'notice:published',
  /** 会话已创建（登录成功）：{ userId: number } */
  SESSION_CREATED: 'session:created',
  /** 会话已销毁（登出 / 被踢 / 过期）：{ userId: number } */
  SESSION_DESTROYED: 'session:destroyed',
} as const;

/** 事件载荷类型表（发布与订阅共用的契约）。 */
export interface AppEventPayloads {
  [AppEvents.NOTICE_PUBLISHED]: { userIds: number[] };
  [AppEvents.SESSION_CREATED]: { userId: number };
  [AppEvents.SESSION_DESTROYED]: { userId: number };
}

const bus = new EventEmitter({ captureRejections: true });

// 每个事件允许的监听数上限：超过即报警，提示有订阅者注册/反注册不对称（连接泄漏的早期信号）
bus.setMaxListeners(20);

/**
 * 发布事件（异步：监听器抛错不影响生产者链路）。
 * @param event 事件名
 * @param payload 载荷
 */
export function emit<K extends keyof AppEventPayloads>(event: K, payload: AppEventPayloads[K]): void {
  bus.emit(event, payload);
}

/**
 * 订阅事件。
 * @param event 事件名
 * @param listener 处理器（同步或异步均可）
 * @returns 反注册函数（组件销毁 / 模块关闭时调用，防泄漏）
 */
export function on<K extends keyof AppEventPayloads>(
  event: K,
  listener: (payload: AppEventPayloads[K]) => void | Promise<void>,
): () => void {
  bus.on(event, listener as (...args: unknown[]) => void);
  return () => {
    bus.off(event, listener as (...args: unknown[]) => void);
  };
}

/** 当前订阅者数量（健康检查 / 测试用）。 */
export function listenerCount<K extends keyof AppEventPayloads>(event: K): number {
  return bus.listenerCount(event);
}
