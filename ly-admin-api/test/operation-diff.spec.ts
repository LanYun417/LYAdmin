/**
 * 操作日志字段级 Diff 单测（纯函数）。
 * 覆盖：仅输出变化字段、新增/删除标记、Date/BigInt 归一、深相等、无变化返回 null。
 */
import { describe, expect, it } from 'vitest';
import { computeOperationDiff, DIFF_ADDED, DIFF_DELETED } from '../src/common/log/operation-diff.js';

describe('computeOperationDiff', () => {
  it('无采集任一侧返回 null', () => {
    expect(computeOperationDiff(null, { a: 1 })).toBeNull();
    expect(computeOperationDiff({ a: 1 }, null)).toBeNull();
    expect(computeOperationDiff(undefined, undefined)).toBeNull();
  });

  it('仅输出变化字段，相同值不出现', () => {
    const diff = computeOperationDiff(
      { nickname: '旧', email: 'a@x.com', status: 1 },
      { nickname: '新', email: 'a@x.com', status: 1 },
    );
    expect(diff).toEqual({ nickname: { from: '旧', to: '新' } });
  });

  it('新增字段标 __added__，删除字段标 __deleted__', () => {
    const diff = computeOperationDiff({ a: 1, b: 2 }, { a: 1, c: 3 });
    expect(diff).toEqual({ b: DIFF_DELETED, c: DIFF_ADDED });
  });

  it('Date 与 BigInt 归一后可比（相同值不算变化）', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    // 不同 Date 实例但同一时刻
    const diff = computeOperationDiff({ t: d }, { t: new Date('2026-01-01T00:00:00.000Z') });
    expect(diff).toBeNull();
    // BigInt 与「同值字符串」视为相同（归一化后）
    expect(computeOperationDiff({ id: 1n }, { id: '1' })).toBeNull();
    // 数值变化仍能检出
    expect(computeOperationDiff({ id: 1n }, { id: 2n })).toEqual({ id: { from: '1', to: '2' } });
  });

  it('嵌套对象深比较', () => {
    expect(computeOperationDiff({ o: { a: [1, 2], b: 'x' } }, { o: { a: [1, 2], b: 'x' } })).toBeNull();
    expect(computeOperationDiff({ o: { a: [1, 2] } }, { o: { a: [1, 3] } })).toEqual({
      o: { from: { a: [1, 2] }, to: { a: [1, 3] } },
    });
  });

  it('完全相同时返回 null（不写无用列）', () => {
    expect(computeOperationDiff({ a: 1 }, { a: 1 })).toBeNull();
  });
});
