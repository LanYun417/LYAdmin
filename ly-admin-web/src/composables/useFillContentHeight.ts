/**
 * 「整块撑满内容区」的高度测量。
 *
 * 背景：内容区滚动容器是 `el-scrollbar`，其 `.el-scrollbar__view` 是 `display:inline-block`、
 * 高度由内容撑开。任何 `height:100%` / `max-height:100%` 在这里都会解析成 0（表头表体一起塌，
 * 本项目在字典项抽屉上连踩两次）。因此统一用「实测像素」：先算整块可用高度并写到根节点上，
 * 内部再用 flex 分配，表格显式拿像素高度。
 *
 * 计算口径：`可用高度 = 滚动容器 clientHeight − 本块顶部偏移 − .app-main 的 padding-bottom`。
 * 底部 padding 必须扣掉，否则分页会被切掉一条。
 */
import { useResizeObserver } from '@vueuse/core';
import { toValue, type MaybeRefOrGetter } from 'vue';

export interface UseFillContentHeightOptions {
  /** 可视区不足时按此高度渲染（允许整页滚动），避免内容被压没 */
  minHeight?: number;
  /** 是否启用测量；传 false（如窄屏改回自然高度）时不接管高度 */
  enabled?: MaybeRefOrGetter<boolean>;
}

export function useFillContentHeight(options: UseFillContentHeightOptions = {}) {
  const { minHeight = 480, enabled = true } = options;

  /** 整块根节点（高度在这里落地） */
  const rootRef = ref<HTMLElement>();
  /** 量出来的整块高度（px）；undefined 表示未启用 / 未测量，交给内容自然高度 */
  const rootHeight = ref<number>();
  /** 内容区滚动容器（挂载后才能拿到） */
  const scrollerEl = shallowRef<HTMLElement>();

  /** 计算并写入整块高度 */
  function measure(): void {
    const root = rootRef.value;
    if (!root || !toValue(enabled)) {
      rootHeight.value = undefined;
      return;
    }
    // 标准场景：页面在布局的 .content-scrollbar 内；找不到（如被放进抽屉）则不接管高度
    const scroller = root.closest('.el-scrollbar__wrap') as HTMLElement | null;
    if (!scroller) {
      rootHeight.value = undefined;
      return;
    }
    const offsetTop = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const appMain = root.closest('.app-main');
    const paddingBottom = appMain ? Number.parseFloat(getComputedStyle(appMain).paddingBottom) || 0 : 0;
    const available = Math.floor(scroller.clientHeight - offsetTop - paddingBottom);
    const next = Math.max(available, minHeight);
    // 1px 容差：避免小数像素反复触发 ResizeObserver 造成抖动
    if (rootHeight.value === undefined || Math.abs(rootHeight.value - next) > 1) {
      rootHeight.value = next;
    }
  }

  onMounted(() => {
    scrollerEl.value = (rootRef.value?.closest('.el-scrollbar__wrap') as HTMLElement | null) ?? undefined;
    measure();
  });
  // 内容区尺寸变化（窗口缩放 / 标签页增减 / 侧边栏折叠导致换行）都要重算
  useResizeObserver(scrollerEl, () => measure());
  useResizeObserver(rootRef, () => measure());
  // keep-alive 切回来时容器尺寸可能已变化
  onActivated(() => {
    void nextTick(measure);
  });
  // 断点切换（宽屏 ↔ 窄屏）时重新决定是否接管高度
  watch(
    () => toValue(enabled),
    () => {
      void nextTick(measure);
    },
  );

  return { rootRef, rootHeight, measure };
}
