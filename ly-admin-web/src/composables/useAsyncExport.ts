/**
 * 「后台导出」复用逻辑：日志列表页一键把当前筛选条件转成异步导出任务。
 *
 * 与页面原有的同步导出的关系：
 * - 同步导出（保持原样）：小数据量秒得，走 HTTP 流式，不占额外存储；
 * - 后台导出（本 composable）：大数据量不挂住请求线程，生成完通知领取。
 * 两者数据口径完全一致（后端同一套 where / 游标分页 / 上限预检），
 * 区别只在「谁等结果」——用户按数据量自选。
 */
import { useRouter } from 'vue-router';
import { ElMessage } from '@/utils/element';
import { createExportTaskApi, type ExportModuleKey } from '@/api/exportTask';

/**
 * @returns createAsyncExport 创建后台导出任务（成功后可选择跳下载中心）
 */
export function useAsyncExport(): {
  createAsyncExport: (module: ExportModuleKey, query?: Record<string, unknown>, gotoCenter?: boolean) => Promise<void>;
} {
  const router = useRouter();

  /**
   * 创建后台导出任务。
   * @param module 导出模块（login-log / operation-log / http-log）
   * @param query 当前列表页的筛选条件原样透传（后端按同一口径导出）
   * @param gotoCenter 是否创建后跳转下载中心（默认 true）
   */
  async function createAsyncExport(
    module: ExportModuleKey,
    query: Record<string, unknown> = {},
    gotoCenter = true,
  ): Promise<void> {
    try {
      await createExportTaskApi({ module, query, timezoneOffset: new Date().getTimezoneOffset() });
      ElMessage.success('已转入后台生成，完成后将在下载中心可下载');
      if (gotoCenter) {
        void router.push('/log/download-center');
      }
    } catch {
      // 失败提示由请求层统一给出（含超上限时的具体条数）
    }
  }

  return { createAsyncExport };
}
