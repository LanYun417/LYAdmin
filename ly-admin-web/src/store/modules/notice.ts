/**
 * 通知 Store：维护未读数（顶栏红点）。
 *
 * 为什么放 Store 而不是组件内 state：顶栏铃铛与通知中心页面都要读写同一个未读数，
 * 放两处会出现「页面里已标记已读、铃铛还亮着」的不一致。
 *
 * 刷新时机刻意保守：**挂载时 + 每次已读/删除动作后**，不做定时轮询——
 * 凭空产生的请求对后端没有价值，真需要时由页面主动刷新即可。
 */

import { getNoticeUnreadCountApi } from '@/api/notice';

export const useNoticeStore = defineStore('notice', () => {
  /** 未读数 */
  const unreadCount = ref(0);
  /** 是否已拉取过（避免未登录/接口异常时反复重试） */
  const loaded = ref(false);

  /** 拉取未读数 */
  async function refreshUnread(): Promise<void> {
    const result = await getNoticeUnreadCountApi();
    unreadCount.value = result.count;
    loaded.value = true;
  }

  /** 标记已读后就地减一，避免再发一次请求 */
  function decreaseUnread(): void {
    unreadCount.value = Math.max(unreadCount.value - 1, 0);
  }

  /** 直接置零（全部已读 / 清空后） */
  function resetUnread(): void {
    unreadCount.value = 0;
  }

  /** 登录切换账号时清零，避免把上一个账号的未读数带过来 */
  function clear(): void {
    unreadCount.value = 0;
    loaded.value = false;
  }

  return { unreadCount, loaded, refreshUnread, decreaseUnread, resetUnread, clear };
});
