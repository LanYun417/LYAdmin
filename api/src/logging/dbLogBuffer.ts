/**
 * 数据库 SQL 日志批量缓冲区。
 * 模块职责：把 Sequelize `logging` 钩子产生的高频 SQL 日志**批量缓冲 + 定时落盘**，
 * 避免在请求回调中同步执行 `JSON.stringify` + 流写入，减少事件循环阻塞。
 *
 * 设计要点：
 * - 上游 `config/database.ts` 的 SQL 钩子只做「构造记录 + 入队」，不再直接写文件；
 * - 达到 `FLUSH_THRESHOLD` 条或距上次落盘满 `FLUSH_INTERVAL_MS` 毫秒时，批量写出；
 * - **日志内容与格式完全不变**：仍按 `logManager.writeLog('db', record)` 逐条写 JSON Lines，
 *   仅改变写入时机，不丢日志、不改字段；
 * - 进程退出前必须调用 `flushDbLogs()` 落盘（已接入 `logging/processHandlers.ts` 的优雅退出与
 *   uncaughtException 处理），避免缓冲区尾部日志丢失。
 *
 * 局限（重要）：
 * - 若进程被 **SIGKILL / 断电** 等无法捕获的方式强制终止，缓冲区中未到落盘时机的日志会丢失
 *   （最坏约 `FLUSH_INTERVAL_MS` 或 `FLUSH_THRESHOLD` 条）；正常 SIGINT/SIGTERM/异常退出均已覆盖。
 */
import { writeLog } from '@/logging/logManager';
import type { DbLogRecord } from '@/logging/types';

/** 缓冲达到该条数时立即落盘。 */
const FLUSH_THRESHOLD = 200;

/** 最小落盘间隔（毫秒）：避免低频场景下日志长期滞留内存。 */
const FLUSH_INTERVAL_MS = 100;

/** 待落盘的 SQL 日志缓冲。 */
let buffer: DbLogRecord[] = [];

/** 定时落盘句柄（存在即表示已排期）。 */
let flushTimer: NodeJS.Timeout | null = null;

/**
 * 立即落盘缓冲区中的全部日志（幂等；缓冲为空时仅清理定时器）。
 * 逐条调用 `writeLog('db', ...)`，保持文件格式（JSON Lines）与内容不变。
 */
export function flushDbLogs(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) {
    return;
  }
  const pending = buffer;
  buffer = [];
  for (const record of pending) {
    try {
      writeLog('db', record);
    } catch (error) {
      // 与 logManager 的约定一致：日志写入失败绝不影响业务
      console.error('[DbLogBuffer] 写入数据库日志失败:', error);
    }
  }
}

/**
 * 入队一条 SQL 日志。
 * 达到阈值立即落盘，否则排期一次定时落盘（仅排期一次）。
 * @param record SQL 日志记录
 */
export function enqueueDbLog(record: DbLogRecord): void {
  buffer.push(record);
  if (buffer.length >= FLUSH_THRESHOLD) {
    flushDbLogs();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(flushDbLogs, FLUSH_INTERVAL_MS);
  }
}
