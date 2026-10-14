/**
 * 列表分页查询通用 hook：统一收口列表数据、loading、分页、条件查询与重置。
 */
import { onBeforeUnmount, onMounted, reactive, ref, type Ref } from 'vue';
import { debounce } from 'lodash-es';
import type { PageResult } from '@/types/api';

export interface UseTableOptions {
  /** 挂载即拉取首屏数据。抽屉等需由外部（如 watch 打开）触发时设为 false。默认 true。 */
  immediate?: boolean;
  /** 默认每页条数。默认 20。 */
  defaultPageSize?: number;
}

/**
 * 列表分页查询通用逻辑（P2 复用），统一收口「列表三件套」：
 * 数据 ref + loading + 分页(total / page / pageSize) + 拉取 + 条件查询 + 重置。
 *
 * 已内置：
 * - 竞态保护（请求序号 seq）：快速翻页 / 改查询时仅最后一次响应落地，避免乱序覆盖；
 * - 查询输入防抖（searchInput，300ms）：用于搜索框 @input 绑定，避免逐字符触发请求；
 * - reset：清空筛选条件并回到第 1 页重新拉取；
 * - immediate：控制是否在 onMounted 自动拉取首屏。
 *
 * 约定：fetchApi 接收「筛选条件 + { page, pageSize }」并返回 PageResult<T>；
 * 各页面在 fetchApi 内自行完成参数规整（空串→undefined、日期范围注入、单位换算、固定参数等），
 * 因此本函数对具体接口参数结构保持无感知、可通吃所有列表页。
 *
 * @param fetchApi 列表接口
 * @param defaultQuery 默认筛选条件（不含 page / pageSize，由本函数托管）
 * @param options immediate / defaultPageSize
 */
export function useTable<T, Q extends object = Record<string, unknown>>(
  fetchApi: (params: Q & { page: number; pageSize: number }) => Promise<PageResult<T>>,
  defaultQuery: Q,
  options: UseTableOptions = {},
) {
  const { immediate = true, defaultPageSize = 20 } = options;

  const loading = ref(false);
  const list = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const query = reactive({ ...defaultQuery, page: 1, pageSize: defaultPageSize }) as Q & {
    page: number;
    pageSize: number;
  };

  /** 请求序号：竞态保护，仅最后一次请求的响应会落地，避免快速翻页/改查询时乱序覆盖 */
  let seq = 0;

  /** 查询列表 */
  const getList = async (): Promise<void> => {
    const mySeq = ++seq;
    loading.value = true;
    try {
      const res = await fetchApi({ ...query });
      // 竞态保护：若已发起更新的请求（mySeq !== seq），丢弃本次滞后响应
      if (mySeq !== seq) return;
      list.value = res.list ?? [];
      total.value = res.total ?? 0;
    } finally {
      // 仅当本次仍是「最新请求」时才收尾 loading，否则交给更新的请求
      if (mySeq === seq) loading.value = false;
    }
  };

  /** 条件查询（重置到第一页） */
  const search = (): void => {
    query.page = 1;
    void getList();
  };

  /** 查询输入防抖：用于搜索框 @input 绑定，避免逐字符触发请求（300ms）。组件卸载时自动取消。 */
  const searchInput = debounce((): void => {
    search();
  }, 300);

  /** 重置筛选条件并回到第一页重新拉取（pageSize 保持不变） */
  const reset = (): void => {
    Object.assign(query, defaultQuery);
    query.page = 1;
    void getList();
  };

  /** 页码变化 */
  const changePage = (current: number): void => {
    query.page = current;
    void getList();
  };

  /** 每页条数变化（回到第一页） */
  const changePageSize = (size: number): void => {
    query.pageSize = size;
    query.page = 1;
    void getList();
  };

  onMounted(() => {
    if (immediate) void getList();
  });

  onBeforeUnmount(() => {
    searchInput.cancel();
  });

  return {
    loading,
    list,
    total,
    query,
    getList,
    search,
    searchInput,
    reset,
    changePage,
    changePageSize,
  };
}
