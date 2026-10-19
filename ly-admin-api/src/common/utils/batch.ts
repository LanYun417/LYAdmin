/**
 * 批量写操作的统一结果与失败归因。
 *
 * 为什么不是「整批事务回滚」：批量删除的典型场景是管理员勾了一屏数据点删除，
 * 其中一两条因业务护栏不可删（超管、内置角色、当前登录账号）。若整批回滚，
 * 用户只会看到一句「删除失败」而不知道卡在哪；逐条执行并返回 `skipped` 明细，
 * 才能既完成大部分操作、又让人知道剩下几条为什么没删掉。
 *
 * 注意与「批量导入」区分：导入要么全成功要么全失败（有事务语义）；
 * 删除是幂等的、可部分成功，两者口径不同。
 */
import { HttpException } from '@nestjs/common';

/** 单条被跳过的原因。 */
export interface BatchSkippedItem {
  /** 记录 id */
  id: number;
  /** 记录名称（账号 / 角色名 / 字典名；查不到时为 `#id`） */
  name: string;
  /** 跳过原因（来自业务异常消息，可直接展示给用户） */
  reason: string;
}

/** 批量删除结果。 */
export interface BatchDeleteResult {
  /** 实际删除条数 */
  deleted: number;
  /** 被跳过的记录及原因 */
  skipped: BatchSkippedItem[];
}

/** 逐条批量执行时把失败归因成一句可展示的文案。 */
export function batchFailureReason(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (response !== null && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      if (Array.isArray(message)) {
        return message.map((item) => String(item)).join('；');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return error.message;
  }
  return error instanceof Error ? error.message : '未知错误';
}

/**
 * 逐条执行批量操作并汇总结果。
 * @param ids 待处理的 id 列表
 * @param handler 单条处理函数（内部应复用单条接口的服务方法，以继承全部业务护栏）
 * @param nameOf 失败时取名称的回调（查不到时返回 `#id`）
 * @returns 成功条数与被跳过的明细
 */
export async function runBatchDelete(
  ids: number[],
  handler: (id: number) => Promise<void>,
  nameOf: (id: number) => string,
): Promise<BatchDeleteResult> {
  let deleted = 0;
  const skipped: BatchSkippedItem[] = [];
  for (const id of ids) {
    try {
      await handler(id);
      deleted += 1;
    } catch (error) {
      skipped.push({ id, name: nameOf(id), reason: batchFailureReason(error) });
    }
  }
  return { deleted, skipped };
}
