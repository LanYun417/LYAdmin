/**
 * SSE 全局桥接：登录后建立连接，把服务端事件分发到各消费方。
 *
 * 分发策略（事件 → 消费）：
 * - notice：通知发布/变化 → 通知 store 刷新未读数（铃铛红点实时 +1）；
 * - online：在线会话上下线 → 广播给使用方（在线用户页自注册回调刷新列表）；
 * - metrics：监控页按需订阅，不在此处处理。
 *
 * 为什么放 App.vue 根组件：连接生命周期与「登录态」严格一致——
 * 登录建立、登出关闭；放在页面级会随路由切换反复重连。
 */
import { onBeforeUnmount, watch } from 'vue';
import { useUserStore } from '@/store/modules/user';
import { useNoticeStore } from '@/store/modules/notice';
import { SseEventName, closeSse, connectSse, onSseEvent } from '@/utils/sse';

/** 在线会话变化的使用方回调（在线用户页注册）。 */
const onlineListeners = new Set<() => void>();

/** 注册「在线会话变化」回调（供监控/在线用户页调用）。 */
export function onOnlineChange(listener: () => void): () => void {
  onlineListeners.add(listener);
  return () => onlineListeners.delete(listener);
}

/**
 * 建立 SSE 全局桥接（幂等：应在根组件挂载时调用一次）。
 */
export function useSseBridge(): void {
  const userStore = useUserStore();
  const noticeStore = useNoticeStore();

  // 登录态变化：已登录且未连接 → 连；登出 → 断
  watch(
    () => userStore.isLogin,
    (isLogin) => {
      if (isLogin) {
        void connectSse();
        return;
      }
      closeSse();
    },
    { immediate: true },
  );

  // 新通知：刷新未读数（铃铛数字即时更新，无需等下次进入页面）
  const offNotice = onSseEvent(SseEventName.NOTICE, () => {
    void noticeStore.refreshUnread();
  });

  // 在线会话变化：通知使用方刷新列表（空数据也触发，消费方自行判断）
  const offOnline = onSseEvent(SseEventName.ONLINE, () => {
    for (const listener of onlineListeners) {
      listener();
    }
  });

  onBeforeUnmount(() => {
    offNotice();
    offOnline();
  });
}

/** 测试辅助：清空在线回调。 */
export function __resetOnlineListenersForTest(): void {
  onlineListeners.clear();
}
