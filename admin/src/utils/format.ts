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
