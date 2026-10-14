/**
 * 日志归档调度器。
 * 模块职责：服务启动时立即补跑一次归档（覆盖停机跨天/多天场景），
 * 随后自调度到次日 `archiveHour:archiveMinute`（默认 00:05）执行归档，每次执行后重算延迟防漂移。
 *
 * 设计：不引入 cron 依赖，使用原生 `setTimeout` 自调度。
 */
import dayjs from 'dayjs';
import { config } from '@/config';
import { archivePastLogs } from './archiver';

/** 当前定时器句柄（未调度时为 null）。 */
let timer: NodeJS.Timeout | null = null;

/**
 * 计算距离下一次归档时刻的毫秒数。
 * 若今日归档时刻已过，则顺延到次日同一时刻。
 * @returns 毫秒延迟（> 0）
 */
function msUntilNextRun(): number {
  const now = dayjs();
  let next = now.hour(config.log.archiveHour).minute(config.log.archiveMinute).second(0).millisecond(0);
  if (!next.isAfter(now)) {
    next = next.add(1, 'day');
  }
  return Math.max(next.diff(now), 0);
}

/** 执行一次归档并记录结果（异常仅记录，不抛出）。 */
async function runArchive(reason: string): Promise<void> {
  try {
    const results = await archivePastLogs();
    const archived = results.filter((r) => r.status === 'archived').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    console.log(
      `[LogScheduler] ${reason}归档完成：成功 ${archived}、跳过 ${skipped}、失败 ${failed}（共 ${results.length} 项）`,
    );
  } catch (error) {
    console.error(`[LogScheduler] ${reason}归档失败:`, error);
  }
}

/** 调度下一次归档（每次重算延迟，规避 DST / 时钟漂移）。 */
function scheduleNext(): void {
  const delay = msUntilNextRun();
  timer = setTimeout(() => {
    void runArchive('定时').then(() => scheduleNext());
  }, delay);
}

/**
 * 启动日志调度器（幂等）。
 * ① 立即补跑一次归档；② 调度到次日归档时刻。
 */
export function startLogScheduler(): void {
  if (timer) {
    return; // 已启动，避免重复调度
  }

  // 启动补跑：不阻塞启动流程
  void runArchive('启动补跑');

  scheduleNext();
  console.log(
    `[LogScheduler] 已启动，下次归档: ${dayjs().add(msUntilNextRun(), 'millisecond').format('YYYY-MM-DD HH:mm:ss')}`,
  );
}

/**
 * 停止日志调度器，清理定时器（幂等）。
 */
export function stopLogScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
