import { onBeforeUnmount, onMounted, reactive, ref, type Ref } from 'vue';
import { debounce } from 'lodash-es';
import type { PageResult } from '@/types/api';

/**
 * 列表分页查询通用逻辑（P2 复用）。
 *
 * 已内置：
 * - 竞态保护（请求序号 seq）：快速翻页 / 改查询时，仅最后一次请求的响应会落地，避免乱序覆盖；
 * - 查询输入防抖（searchInput，300ms）：用于搜索框 `@input` 绑定，避免逐字符触发请求。
 *
 * @param fetchApi 列表接口（接收含 page/pageSize 的参数）
 * @param defaultQuery 默认查询条件
 * @param defaultPageSize 默认每页条数
 */
export function useTable<T, P extends object = Record<string, unknown>>(
  fetchApi: (params: P) => Promise<PageResult<T>>,
  defaultQuery: Partial<P> = {},
  defaultPageSize = 10,
) {
  const loading = ref(false);
  const list = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(defaultPageSize);
  const query = reactive({ ...defaultQuery }) as Partial<P>;

  /** 请求序号：竞态保护，仅最后一次请求的响应会落地，避免快速翻页/改查询时乱序覆盖 */
  let seq = 0;

  /** 查询列表 */
  const getList = async (): Promise<void> => {
    const mySeq = ++seq;
    loading.value = true;
    try {
      const params = {
        ...query,
        page: page.value,
        pageSize: pageSize.value,
      } as unknown as P;
      const res = await fetchApi(params);
      // 竞态保护：若已发起更新的请求（mySeq !== seq），丢弃本次滞后响应
      if (mySeq !== seq) {
        return;
      }
      list.value = res.list ?? [];
      total.value = res.total ?? 0;
    } finally {
      // 仅当本次仍是「最新请求」时才收尾 loading，否则交给更新的请求
      if (mySeq === seq) {
        loading.value = false;
      }
    }
  };

  /** 条件查询（重置到第一页） */
  const search = (): void => {
    page.value = 1;
    void getList();
  };

  /** 查询输入防抖：用于搜索框 @input 绑定，避免逐字符触发请求（300ms）。组件卸载时自动取消。 */
  const searchInput = debounce((): void => {
    search();
  }, 300);

  /** 重置查询条件 */
  const reset = (): void => {
    const source = defaultQuery as Record<string, unknown>;
    const target = query as Record<string, unknown>;
    Object.keys(target).forEach((key) => {
      target[key] = source[key] ?? '';
    });
    page.value = 1;
    void getList();
  };

  /** 页码变化 */
  const changePage = (current: number): void => {
    page.value = current;
    void getList();
  };

  /** 每页条数变化 */
  const changePageSize = (size: number): void => {
    pageSize.value = size;
    page.value = 1;
    void getList();
  };

  onMounted(() => {
    void getList();
  });

  onBeforeUnmount(() => {
    searchInput.cancel();
  });

  return {
    loading,
    list,
    total,
    page,
    pageSize,
    query,
    getList,
    search,
    searchInput,
    reset,
    changePage,
    changePageSize,
  };
}
