/**
 * 展示层格式化工具（日期时间 / 文件大小 / 耗时）。
 * 约定：空值统一以占位符返回而非抛错，便于模板直接渲染。
 */
import dayjs from 'dayjs';

/**
 * 格式化日期时间。
 *
 * @param value 时间值（字符串/时间戳/Date）
 * @param pattern dayjs 格式串，默认 `YYYY-MM-DD HH:mm:ss`
 * @returns 格式化后的字符串，空值返回 `-`
 */
export function formatDate(value?: string | number | Date | null, pattern = 'YYYY-MM-DD HH:mm:ss'): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return dayjs(value).format(pattern);
}

/** 仅日期（YYYY-MM-DD） */
export function formatDateOnly(value?: string | number | Date | null): string {
  return formatDate(value, 'YYYY-MM-DD');
}

/** 完整日期时间（YYYY-MM-DD HH:mm:ss），formatDate 的语义化别名 */
export function formatDateTime(value?: string | number | Date | null): string {
  return formatDate(value, 'YYYY-MM-DD HH:mm:ss');
}

/** 仅时间（HH:mm:ss） */
export function formatTimeOnly(value?: string | number | Date | null): string {
  return formatDate(value, 'HH:mm:ss');
}

/**
 * 格式化文件大小。
 *
 * @param bytes 字节数
 */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${index === 0 ? size : size.toFixed(2)} ${units[index]}`;
}

/**
 * 格式化耗时。
 *
 * @param ms 毫秒数
 */
export function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined) {
    return '-';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * 在线时长：登录时刻距现在的人读时长（如「3 天 2 小时」「45 分钟」「12 秒」）。
 * 与 formatDuration 区分：后者面向「毫秒级耗时」（任务执行等），粒度到秒已足够；
 * 本函数面向「会话存活时长」，跨度从秒到天，按人读习惯取舍。
 *
 * @param startedAt 登录时间（ISO 串 / 时间戳 / Date）
 */
export function formatOnlineDuration(startedAt?: string | number | Date | null): string {
  if (startedAt === null || startedAt === undefined || startedAt === '') {
    return '-';
  }
  const started = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  if (!Number.isFinite(started)) {
    return '-';
  }
  // 未来时间（客户端时钟回拨）按 0 处理，不显示负数
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  }
  return `${minutes} 分钟`;
}
