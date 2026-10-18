/**
 * 日志删除通用逻辑：单条删除、多选批量删除、二次确认与删除后的列表收尾。
 * 模块职责：三个日志页（登录 / 操作 / HTTP）删除交互完全同构，集中在此避免三份重复；
 * 页面只需注入各自的批量 / 单条接口与列表上下文。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';

export interface UseLogDeleteOptions<T extends { id: number }> {
  /** 批量删除接口（单条删除也走同一个服务端能力，由页面区分单条接口） */
  batchApi: (ids: number[]) => Promise<unknown>;
  /** 单条删除接口 */
  singleApi: (id: number) => Promise<unknown>;
  /** 当前页数据（用于判断删除后是否需要回退一页） */
  list: Ref<T[]>;
  /** 分页查询对象（读写 page） */
  query: { page: number };
  /** 重新拉取列表 */
  getList: () => Promise<void>;
  /** 删除成功后的附加清理（如清空展开行详情缓存） */
  onDeleted?: (ids: number[]) => void;
}

/**
 * 日志删除逻辑。
 * @param options 接口与列表上下文
 * @returns 选中行、删除中状态与两个删除入口
 */
export function useLogDelete<T extends { id: number }>(options: UseLogDeleteOptions<T>) {
  const { batchApi, singleApi, list, query, getList, onDeleted } = options;

  /** 表格多选结果 */
  const selected = ref<T[]>([]) as Ref<T[]>;
  /** 删除请求进行中（防重复提交） */
  const deleting = ref(false);

  /** 表格 selection-change 回调 */
  function handleSelectionChange(rows: T[]): void {
    selected.value = rows;
  }

  /**
   * 删除后收尾：若当前页已被删空且不在第一页，回退一页再刷新，
   * 避免停留在空白页。
   */
  async function refreshAfterDelete(deletedCount: number): Promise<void> {
    if (deletedCount >= list.value.length && query.page > 1) {
      query.page -= 1;
    }
    await getList();
    selected.value = [];
  }

  /** 二次确认，取消返回 false */
  async function confirm(text: string): Promise<boolean> {
    try {
      await ElMessageBox.confirm(text, '删除确认', {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
      });
      return true;
    } catch {
      return false;
    }
  }

  /** 删除单条 */
  async function removeOne(row: T): Promise<void> {
    if (deleting.value) {
      return;
    }
    if (!(await confirm('确定删除这条日志吗？删除后不可恢复。'))) {
      return;
    }
    deleting.value = true;
    try {
      await singleApi(row.id);
      onDeleted?.([row.id]);
      ElMessage.success('删除成功');
      await refreshAfterDelete(1);
    } catch {
      // 失败提示由请求层统一弹出，这里只负责复位状态
    } finally {
      deleting.value = false;
    }
  }

  /** 批量删除选中行 */
  async function removeSelected(): Promise<void> {
    if (deleting.value || selected.value.length === 0) {
      return;
    }
    const ids = selected.value.map((row) => row.id);
    if (!(await confirm(`确定删除选中的 ${ids.length} 条日志吗？删除后不可恢复。`))) {
      return;
    }
    deleting.value = true;
    try {
      await batchApi(ids);
      onDeleted?.(ids);
      ElMessage.success(`已删除 ${ids.length} 条日志`);
      await refreshAfterDelete(ids.length);
    } catch {
      // 失败提示由请求层统一弹出，这里只负责复位状态
    } finally {
      deleting.value = false;
    }
  }

  return { selected, deleting, handleSelectionChange, removeOne, removeSelected };
}
