/**
 * 日志管理器（单例）。
 * 模块职责：按“日志类型 + 本地日期”分文件写入（JSON Lines），维护写入流缓存，
 * 支持跨天自动切换新文件并释放旧句柄，提供路径计算与关流能力。
 *
 * 约定（见 docs/system_design.md §3.4 / §8）：
 * - 文件名（对外展示）：`YYYY-M-D.log`，月/日不补零，如 `2026-9-24.log`。
 * - 归档名：`YYYY-M-D.tar.gz`。
 * - 内部日期键：`YYYY-MM-DD`（补零），仅用于排序/比较/Map key，禁止对文件名做字符串排序。
 * - 时区：按服务器本地时区（Asia/Shanghai, +08:00）切分；记录内 `time` 保持 ISO UTC。
 * - 写入失败绝不影响业务：内部吞异常并 console.error，不向调用方抛出。
 */
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { config } from '@/config';
import type { LogRecord, LogType } from './types';

/**
 * 计算内部规范日期键 `YYYY-MM-DD`（补零）。
 * 仅用于排序、比较与 Map key；禁止用于拼接对外文件名。
 * @param date 任意日期
 * @returns 规范日期键，如 `2026-09-24`
 */
export function dateKey(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

/**
 * 获取某日志类型的目录（绝对路径），不存在则递归创建。
 * @param type 日志类型
 * @returns 目录绝对路径，如 `.../api/logs/access`
 */
export function getLogDir(type: LogType): string {
  const dir = path.join(config.logDir, type);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 生成当日日志文件名（月/日不补零）。
 * @param date 日期
 * @returns 文件名，如 `2026-9-24.log`
 */
export function dailyLogFileName(date: Date): string {
  const d = dayjs(date);
  return `${d.year()}-${d.month() + 1}-${d.date()}.log`;
}

/**
 * 获取当日日志文件的绝对路径。
 * @param type 日志类型
 * @param date 日期
 * @returns 绝对路径，如 `.../api/logs/access/2026-9-24.log`
 */
export function dailyLogPath(type: LogType, date: Date): string {
  return path.join(getLogDir(type), dailyLogFileName(date));
}

/**
 * 获取某日期归档文件的绝对路径。
 * @param type 日志类型
 * @param date 日期
 * @returns 绝对路径，如 `.../api/logs/archive/access/2026-9-24.tar.gz`
 */
export function archiveLogPath(type: LogType, date: Date): string {
  const d = dayjs(date);
  return path.join(config.log.archiveDir, type, `${d.year()}-${d.month() + 1}-${d.date()}.tar.gz`);
}

/** 写入流缓存，key = `${type}|${dateKey}`（补零规范键）。 */
const streams = new Map<string, fs.WriteStream>();

/** 各类型当前活跃流对应的日期（用于跨天判定）。 */
const currentDates: Record<LogType, Date | null> = { access: null, db: null, error: null };

/**
 * 取或创建某类型某天的写入流。
 * 流发生 error 时记录日志并移除缓存，下次写入将自动重建。
 * @param type 日志类型
 * @param date 日期
 */
function getStream(type: LogType, date: Date): fs.WriteStream {
  const key = `${type}|${dateKey(date)}`;
  const existing = streams.get(key);
  if (existing) {
    return existing;
  }

  const filePath = dailyLogPath(type, date);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  stream.on('error', (error: Error) => {
    console.error(`[LogManager] ${type} 日志流错误（${key}）:`, error);
    streams.delete(key);
  });
  streams.set(key, stream);
  return stream;
}

/**
 * 写入一条日志（JSON Lines）。
 * 每次按“写入时的本地日期”取/建流；跨天时自动切换新文件并关闭旧流（无需定时器）。
 * 任何异常仅 console.error，绝不向调用方抛出。
 * @param type 日志类型
 * @param record 日志记录
 */
export function writeLog(type: LogType, record: LogRecord): void {
  try {
    const now = new Date();
    const key = dateKey(now);
    const prev = currentDates[type];

    // 跨天：关闭旧日期的流（异步释放句柄，不阻塞当前写入）
    if (prev && dateKey(prev) !== key) {
      void closeStream(type, prev);
    }
    currentDates[type] = now;

    const stream = getStream(type, now);
    stream.write(`${JSON.stringify(record)}\n`);
  } catch (error) {
    console.error(`[LogManager] 写入 ${type} 日志失败:`, error);
  }
}

/**
 * 关闭某类型某天的写入流（幂等；未打开则 no-op）。
 * 归档前调用以释放句柄（Windows 下文件被占用会导致 tar 失败）。
 * @param type 日志类型
 * @param date 日期
 */
export function closeStream(type: LogType, date: Date): Promise<void> {
  const key = `${type}|${dateKey(date)}`;
  const stream = streams.get(key);
  if (!stream) {
    return Promise.resolve();
  }
  streams.delete(key);
  return new Promise<void>((resolve) => {
    stream.end(() => resolve());
  });
}

/**
 * 关闭全部写入流（优雅退出用）。
 * 等待所有流落盘结束后再返回，避免退出时丢失尾部日志。
 */
export async function closeAllStreams(): Promise<void> {
  const entries = [...streams.entries()];
  streams.clear();
  await Promise.all(entries.map(([, stream]) => new Promise<void>((resolve) => stream.end(() => resolve()))));
  currentDates.access = null;
  currentDates.db = null;
  currentDates.error = null;
}
