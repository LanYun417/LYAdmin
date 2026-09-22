import { onMounted, reactive, ref, type Ref } from 'vue';
import type { PageResult } from '@/types/api';

/**
 * 列表分页查询通用逻辑（P2 复用）。
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

  /** 查询列表 */
  const getList = async (): Promise<void> => {
    loading.value = true;
    try {
      const params = {
        ...query,
        page: page.value,
        pageSize: pageSize.value,
      } as unknown as P;
      const res = await fetchApi(params);
      list.value = res.list ?? [];
      total.value = res.total ?? 0;
    } finally {
      loading.value = false;
    }
  };

  /** 条件查询（重置到第一页） */
  const search = (): void => {
    page.value = 1;
    void getList();
  };

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

  return {
    loading,
    list,
    total,
    page,
    pageSize,
    query,
    getList,
    search,
    reset,
    changePage,
    changePageSize,
  };
}
