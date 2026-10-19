/**
 * 列表批量删除通用逻辑：单条删除、多选批量删除、二次确认与删除后的列表收尾。
 *
 * 泛化来源：三个日志页（登录 / 操作 / HTTP）的删除交互完全同构，先抽成 `useLogDelete`；
 * 用户 / 角色 / 字典页需要同样的交互，故升级为通用版本并补两处能力：
 * 1. `noun`：确认文案与提示按业务命名（"日志" / "用户" / "角色"），不再是写死的中文；
 * 2. `summarize`：后端批量删除返回「成功 + 被跳过明细」，提示里要说清"几条没删成、为什么"，
 *    而不是笼统的成功——被超管保护挡下的条目必须让操作者看见。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import type { BatchDeleteSummary } from '@/types/api';

export interface UseBatchDeleteOptions<T extends { id: number }> {
  /** 批量删除接口 */
  batchApi: (ids: number[]) => Promise<BatchDeleteSummary | unknown>;
  /** 单条删除接口 */
  singleApi: (id: number) => Promise<unknown>;
  /** 当前页数据（用于判断删除后是否需要回退一页） */
  list: Ref<T[]>;
  /** 分页查询对象（读写 page） */
  query: { page: number };
  /** 重新拉取列表 */
  getList: () => Promise<void>;
  /** 业务名词，用于确认与成功提示（如「用户」） */
  noun?: string;
  /** 删除成功后的附加清理（如清空展开行详情缓存） */
  onDeleted?: (ids: number[]) => void;
}

/**
 * 批量删除逻辑。
 * @param options 接口与列表上下文
 * @returns 选中行、删除中状态与两个删除入口
 */
export function useBatchDelete<T extends { id: number }>(options: UseBatchDeleteOptions<T>) {
  const { batchApi, singleApi, list, query, getList, noun = '记录', onDeleted } = options;

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
    if (!(await confirm(`确定删除这条${noun}吗？删除后不可恢复。`))) {
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

  /**
   * 提示批量删除结果。
   * 有跳过项时用 warning（并列出前三条原因），全成功才用 success——
   * 否则「删了 3 条、2 条没删成」会被一句"成功"盖过去。
   */
  function notifySummary(summary: BatchDeleteSummary): void {
    if (summary.skipped.length === 0) {
      ElMessage.success(`已删除 ${summary.deleted} 条${noun}`);
      return;
    }
    const reasons = summary.skipped
      .slice(0, 3)
      .map((item) => `${item.name}：${item.reason}`)
      .join('；');
    const more = summary.skipped.length > 3 ? ` 等 ${summary.skipped.length} 条` : '';
    ElMessage.warning(`已删除 ${summary.deleted} 条，${summary.skipped.length} 条被跳过 —— ${reasons}${more}`);
  }

  /** 批量删除选中行 */
  async function removeSelected(): Promise<void> {
    if (deleting.value || selected.value.length === 0) {
      return;
    }
    const ids = selected.value.map((row) => row.id);
    if (!(await confirm(`确定删除选中的 ${ids.length} 条${noun}吗？删除后不可恢复。`))) {
      return;
    }
    deleting.value = true;
    try {
      const result = (await batchApi(ids)) as BatchDeleteSummary;
      onDeleted?.(ids);
      if (result && typeof result === 'object' && 'deleted' in result && Array.isArray(result.skipped)) {
        notifySummary(result);
        await refreshAfterDelete(result.deleted);
      } else {
        // 接口只返回空体（如日志批量删除）时退化为按选中数提示
        ElMessage.success(`已删除 ${ids.length} 条${noun}`);
        await refreshAfterDelete(ids.length);
      }
    } catch {
      // 失败提示由请求层统一弹出，这里只负责复位状态
    } finally {
      deleting.value = false;
    }
  }

  return { selected, deleting, handleSelectionChange, removeOne, removeSelected };
}
