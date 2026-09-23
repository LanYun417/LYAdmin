/**
 * 时区相关日期工具。
 * 约定：API 返回的所有时间字段均为 ISO UTC（带 Z）；
 * 仅在必须由后端渲染人类可读时间的场景（如 CSV 导出），
 * 使用客户端通过 X-Timezone-Offset 请求头告知的时区偏移做格式化。
 */

/** 默认时区偏移（分钟）：北京时间 +08:00（getTimezoneOffset() = -480），与既有数据约定一致 */
const DEFAULT_OFFSET_MINUTES = -480;

/**
 * 按客户端时区偏移格式化日期时间（YYYY-MM-DD HH:mm:ss）。
 * @param value 日期（Date / ISO 字符串 / 时间戳）
 * @param offsetMinutes 客户端 getTimezoneOffset() 分钟值（北京时间 -480）；缺省按 +08:00
 * @returns 格式化字符串，无效输入返回空串
 */
export function formatDateTimeInZone(value: Date | string | number | null | undefined, offsetMinutes?: number): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = Number.isFinite(offsetMinutes) ? (offsetMinutes as number) : DEFAULT_OFFSET_MINUTES;
  // 目标本地时间 = UTC 时间 - 偏移分钟；再按 UTC 形式截取字段即为目标时区的钟面时间
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 19).replace('T', ' ');
}
