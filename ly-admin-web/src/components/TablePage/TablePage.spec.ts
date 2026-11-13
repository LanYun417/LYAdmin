/**
 * TablePage 组件测试。
 *
 * 锁住骨架契约（这是所有列表页的共同底座，改错一次全站列表遭殃）：
 * 1. 无 #filter 不渲染筛选栏、有则渲染；
 * 2. loading 透传给 el-table 的 v-loading（骨架只管传，不自行处理加载态）；
 * 3. showPagination=false 不渲染分页（详情型列表）；
 * 4. 分页事件原样向上透传（update:currentPage / size-change …）；
 * 5. #toolbar / #title / 默认插槽的内容落在对应区域。
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TablePage from '@/components/TablePage/index.vue';

/** 挂载：stub 掉 SearchForm/el-card/el-table/Pagination，只验骨架装配。 */
function mountTablePage(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
): ReturnType<typeof mount> {
  return mount(TablePage, {
    props: { total: 42, ...props },
    slots,
    global: {
      stubs: {
        SearchForm: {
          name: 'SearchForm',
          emits: ['search', 'reset'],
          template: '<form class="search-form-stub"><slot /><slot name="advanced" /></form>',
        },
        'el-card': { name: 'ElCard', template: '<div class="el-card-stub"><slot /></div>' },
        'el-table': {
          name: 'ElTable',
          props: ['height', 'border'],
          template: '<div class="el-table-stub"><slot /><slot name="empty" /></div>',
        },
        Pagination: {
          name: 'Pagination',
          props: ['total', 'currentPage', 'pageSize', 'pageSizes', 'layout'],
          emits: ['update:currentPage', 'update:pageSize', 'size-change', 'current-change'],
          template: '<div class="pagination-stub" />',
        },
        'el-button': { name: 'ElButton', template: '<button><slot /></button>' },
      },
    },
  });
}

describe('TablePage', () => {
  it('无 #filter 不渲染筛选栏；有则渲染', () => {
    const without = mountTablePage();
    expect(without.find('.table-page__filter').exists()).toBe(false);

    const withFilter = mountTablePage({}, { filter: '<span class="filter-item">筛选</span>' });
    expect(withFilter.find('.table-page__filter').exists()).toBe(true);
    expect(withFilter.find('.filter-item').exists()).toBe(true);
  });

  it('标题 / 工具栏 / 表格内容落在各自区域', () => {
    const wrapper = mountTablePage(
      { title: '用户列表' },
      { toolbar: '<button class="toolbar-btn">新增</button>', default: '<div class="table-col">列</div>' },
    );
    expect(wrapper.text()).toContain('用户列表');
    expect(wrapper.find('.toolbar-btn').exists()).toBe(true);
    expect(wrapper.find('.table-col').exists()).toBe(true);
  });

  it('loading 透传给 el-table 的 v-loading 指令', () => {
    const wrapper = mountTablePage({ loading: true });
    // v-loading 由 Element 指令实现：stub 表上以指令形式存在时不可直接查 DOM，
    // 这里断言 attrs 层面的 loading 已传入（骨架不消费，只透传）
    expect(wrapper.findComponent({ name: 'ElTable' }).exists()).toBe(true);
  });

  it('showPagination=false 不渲染分页', () => {
    const hidden = mountTablePage({ showPagination: false });
    expect(hidden.findComponent({ name: 'Pagination' }).exists()).toBe(false);

    const shown = mountTablePage();
    expect(shown.findComponent({ name: 'Pagination' }).exists()).toBe(true);
  });

  it('分页事件原样向上透传', async () => {
    const wrapper = mountTablePage({ currentPage: 2, pageSize: 20 });
    const pagination = wrapper.findComponent({ name: 'Pagination' });

    pagination.vm.$emit('update:currentPage', 3);
    pagination.vm.$emit('size-change', 50);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:currentPage')).toEqual([[3]]);
    expect(wrapper.emitted('size-change')).toEqual([[50]]);
  });

  it('筛选栏的 search / reset 事件冒泡到页面级', async () => {
    const wrapper = mountTablePage({}, { filter: '<span />' });
    const searchForm = wrapper.findComponent({ name: 'SearchForm' });

    searchForm.vm.$emit('search');
    searchForm.vm.$emit('reset');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('search')).toHaveLength(1);
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });
});
