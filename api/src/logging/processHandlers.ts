/**
 * 进程级生命周期处理。
 * 模块职责：注册进程级异常与退出信号处理器，保证异常落盘、日志流优雅关闭。
 *
 * 注册内容（见 docs/system_design.md §2.2 / §7 T04）：
 * - `unhandledRejection`：记录到 error 日志（不退出，交由上层兜底）。
 * - `uncaughtException`：记录到 error 日志后 `process.exit(1)`（进程状态已不确定）。
 * - `SIGINT` / `SIGTERM`：`stopLogScheduler()` + `closeAllStreams()` 后退出（优雅关闭）。
 *
 * 幂等：重复调用 `registerProcessHandlers()` 只会注册一次。
 */
import { reportProcessError } from './errorReporter';
import { flushDbLogs } from './dbLogBuffer';
import { closeAllStreams } from './logManager';
import { stopLogScheduler } from './scheduler';

/** 是否已注册（幂等保护）。 */
let registered = false;

/** 是否正在退出（防止重复触发优雅关闭）。 */
let shuttingDown = false;

/**
 * 优雅关闭：停止归档调度 → 关闭全部日志写入流（等待落盘）→ 退出进程。
 * 关闭过程中的任何异常仅记录，最终仍会退出。
 * @param reason 触发退出的原因（信号名 / 事件名）
 * @param exitCode 退出码
 */
async function shutdown(reason: string, exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    stopLogScheduler();
    // 先落盘 SQL 日志缓冲区（写入流尚未关闭），再关闭全部写入流，避免尾部日志丢失
    flushDbLogs();
    await closeAllStreams();
  } catch (error) {
    console.error('[ProcessHandlers] 优雅关闭失败:', error);
  } finally {
    console.log(`[ProcessHandlers] 收到 ${reason}，日志已落盘，进程退出（code=${exitCode}）`);
    process.exit(exitCode);
  }
}

/**
 * 注册进程级异常与退出信号处理器（幂等）。
 * 应在服务启动早期调用，确保后续异常与退出信号均被正确记录/处理。
 */
export function registerProcessHandlers(): void {
  if (registered) {
    return;
  }
  registered = true;

  // 未处理的 Promise 拒绝：记录错误日志，不退出（避免影响正常请求）
  process.on('unhandledRejection', (reason: unknown) => {
    reportProcessError('unhandledRejection', reason);
  });

  // 未捕获异常：记录错误日志后退出（进程状态不确定，继续运行不安全）
  process.on('uncaughtException', (error: Error) => {
    reportProcessError('uncaughtException', error);
    void shutdown('uncaughtException', 1);
  });

  // 退出信号：优雅关闭（停调度 + 关流）后退出
  process.on('SIGINT', () => {
    void shutdown('SIGINT', 0);
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM', 0);
  });
}
