import { computed } from 'vue';
import { useWindowSize } from '@vueuse/core';

/**
 * 弹层响应式尺寸。
 *
 * 抽屉 / 弹窗 / 气泡等「固定宽度」弹层在窄屏（视口宽度 ≤ 桌面固定宽度）会超出屏幕、出现横向滚动。
 * 本 hook 在视口不足以容纳桌面宽度时，自动降级为 `mobile`（默认铺满 100%），否则保持桌面固定宽度。
 *
 * 用法：
 *   const { size } = useResponsiveSize(860);          // 抽屉：窄屏铺满
 *   const { size } = useResponsiveSize(360, '92%');   // 气泡：窄屏留边距
 *
 * @param desktop 桌面端固定宽度（px）
 * @param mobile  窄屏时的宽度（百分比字符串，默认 '100%' 铺满）
 */
export function useResponsiveSize(desktop: number, mobile: string = '100%') {
  const { width } = useWindowSize();
  const size = computed<string>(() => {
    if (width.value <= desktop) {
      return mobile;
    }
    return `${desktop}px`;
  });
  return { size };
}
