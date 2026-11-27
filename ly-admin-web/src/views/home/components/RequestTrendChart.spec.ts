/**
 * 请求趋势图空态回归测试。
 *
 * 线上问题：首次挂载时接口尚未返回，图表先画出「暂无数据」；数据返回后曲线正常，
 * 但空态文字仍覆盖在图上。ECharts 默认合并 setOption，`graphic: []` 不会清除旧元素，
 * 因此组件必须显式 `replaceMerge: ['graphic']`。
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';

const { init, setOption, dispose } = vi.hoisted(() => {
  const setOption = vi.fn();
  const resize = vi.fn();
  const dispose = vi.fn();
  return {
    setOption,
    resize,
    dispose,
    init: vi.fn(() => ({ setOption, resize, dispose })),
  };
});

vi.mock('@/utils/echarts', () => ({
  default: {
    init,
    // chartTheme.verticalGradient 在渲染时会 new LinearGradient；测试只关心 setOption 入参
    graphic: { LinearGradient: vi.fn() },
  },
}));

import RequestTrendChart from './RequestTrendChart.vue';

describe('RequestTrendChart', () => {
  it('空数据首帧后接到真实数据：清除空态图层并显式替换 graphic', async () => {
    const wrapper = mount(RequestTrendChart, {
      props: { data: { dates: [], requests: [], errors: [] } },
      global: { plugins: [createPinia()] },
    });

    expect(setOption).toHaveBeenCalledTimes(1);
    const initialOption = setOption.mock.calls[0]?.[0] as { graphic: Array<{ style: { text: string } }> };
    expect(initialOption.graphic[0]?.style.text).toBe('暂无数据');

    await wrapper.setProps({
      data: { dates: ['11-27'], requests: [772], errors: [60] },
    });

    expect(setOption).toHaveBeenCalledTimes(2);
    const [nextOption, updateMode] = setOption.mock.calls[1] as [{ graphic: unknown[] }, { replaceMerge: string[] }];
    expect(nextOption.graphic).toEqual([]);
    expect(updateMode).toEqual({ replaceMerge: ['graphic'] });

    wrapper.unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
