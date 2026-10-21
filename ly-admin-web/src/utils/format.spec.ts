import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatTimeOnly,
} from '@/utils/format';

describe('format utils', () => {
  describe('formatDate', () => {
    it('returns "-" for empty values', () => {
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate(null)).toBe('-');
      expect(formatDate('')).toBe('-');
    });

    it('formats a local datetime string with the default pattern', () => {
      // 输入已是本地时间串，dayjs 按本地解析并格式化，结果与输入一致（不依赖时区）
      expect(formatDate('2024-01-02 03:04:05')).toBe('2024-01-02 03:04:05');
    });

    it('honors a custom pattern', () => {
      expect(formatDate('2024-01-02 03:04:05', 'YYYY/MM/DD')).toBe('2024/01/02');
    });

    it('formats Date / number inputs', () => {
      expect(formatDate(new Date('2024-01-02T03:04:05'))).toBe('2024-01-02 03:04:05');
      expect(formatDate(Date.parse('2024-01-02T03:04:05'))).toBe('2024-01-02 03:04:05');
    });

    it('aliases keep consistent semantics', () => {
      expect(formatDateOnly('2024-01-02 03:04:05')).toBe('2024-01-02');
      expect(formatDateTime('2024-01-02 03:04:05')).toBe('2024-01-02 03:04:05');
      expect(formatTimeOnly('2024-01-02 03:04:05')).toBe('03:04:05');
    });
  });

  describe('formatFileSize', () => {
    it('treats non-positive / missing as 0 B', () => {
      expect(formatFileSize(undefined)).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-100)).toBe('0 B');
    });

    it('uses no decimals for bytes and 2 decimals for larger units', () => {
      expect(formatFileSize(1023)).toBe('1023 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });
  });

  describe('formatDuration', () => {
    it('returns "-" for missing values', () => {
      expect(formatDuration(undefined)).toBe('-');
      expect(formatDuration(null)).toBe('-');
    });

    it('renders ms below 1s and seconds above', () => {
      expect(formatDuration(500)).toBe('500 ms');
      expect(formatDuration(1000)).toBe('1.00 s');
      expect(formatDuration(1500)).toBe('1.50 s');
    });
  });
});
