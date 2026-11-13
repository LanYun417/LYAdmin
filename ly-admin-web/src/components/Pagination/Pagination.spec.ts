/**
 * Pagination 组件测试。
 *
 * 重点锁住「切换每页条数时页码归 1」这条规则：它防的是「在 100 条/页时
 * 从第 8 页切到 20 条/页 → 停留越界页码 → 列表空白」这个真实翻车场景。
 * Element 的 el-pagination 被 stub 成可发射事件的替身（只验封装层逻辑）。
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Pagination from '@/components/Pagination/index.vue';

/** 挂载并取 el-pagination 替身（stub 后可按名查找）。 */
function mountPagination(props: Record<string, unknown> = {}): ReturnType<typeof mount> {
  return mount(Pagination, {
    props: { total: 100, ...props },
    global: {
      stubs: {
        // 保留一个可查询、可发射事件的替身；attrs 透传便于断言 size 等
        'el-pagination': {
          name: 'ElPagination',
          props: ['total', 'currentPage', 'pageSize', 'pageSizes', 'layout', 'background', 'size'],
          emits: ['size-change', 'current-change'],
          template: '<div class="el-pagination-stub" />',
        },
      },
    },
  });
}

describe('Pagination', () => {
  it('默认 props：第 1 页 / 20 条 / 带背景', () => {
    const wrapper = mountPagination();
    const el = wrapper.findComponent({ name: 'ElPagination' });
    expect(el.props('currentPage')).toBe(1);
    expect(el.props('pageSize')).toBe(20);
    expect(el.props('background')).toBe(true);
    expect(el.props('total')).toBe(100);
  });

  it('窄屏（≤768px）自动切 small', async () => {
    // jsdom 默认 1024 宽：先断言 default
    const wrapper = mountPagination();
    expect(wrapper.findComponent({ name: 'ElPagination' }).props('size')).toBe('default');

    // 视口收窄到 390px（useWindowSize 监听 resize）
    window.innerWidth = 390;
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    // 等 @vueuse 的 requestAnimationFrame 节流落地
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(wrapper.findComponent({ name: 'ElPagination' }).props('size')).toBe('small');
    window.innerWidth = 1024;
  });

  it('切换每页条数：emit update:pageSize + 页码归 1 + size-change', async () => {
    const wrapper = mountPagination({ currentPage: 8, pageSize: 20 });
    const el = wrapper.findComponent({ name: 'ElPagination' });

    el.vm.$emit('size-change', 50);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:pageSize')).toEqual([[50]]);
    // 关键规则：页码必须归 1（否则停留在越界页）
    expect(wrapper.emitted('update:currentPage')).toEqual([[1]]);
    expect(wrapper.emitted('size-change')).toEqual([[50]]);
  });

  it('翻页：透传 update:currentPage 与 current-change', async () => {
    const wrapper = mountPagination({ currentPage: 2 });
    const el = wrapper.findComponent({ name: 'ElPagination' });

    el.vm.$emit('current-change', 3);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:currentPage')).toEqual([[3]]);
    expect(wrapper.emitted('current-change')).toEqual([[3]]);
  });
});
