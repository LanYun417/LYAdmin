/**
 * 操作日志「变更前后值」采集单测。
 * 覆盖：ALS 容器读写、脱敏（密码字段）、超长截断、未采集时返回 null（不写空对象占位）。
 */
import { describe, expect, it } from 'vitest';
import {
  buildSnapshotFields,
  recordAfter,
  recordBefore,
  runWithSnapshot,
  SNAPSHOT_MAX_CHARS,
  type OperationSnapshot,
} from '../src/common/log/operation-snapshot.js';

describe('operation-snapshot', () => {
  it('在容器内 record 的前后值能被读到', () => {
    const snapshot: OperationSnapshot = {};
    runWithSnapshot(snapshot, () => {
      recordBefore({ nickname: '张三' });
      recordAfter({ nickname: '李四' });
    });

    const fields = buildSnapshotFields(snapshot);
    expect(JSON.parse(String(fields.beforeData))).toEqual({ nickname: '张三' });
    expect(JSON.parse(String(fields.afterData))).toEqual({ nickname: '李四' });
  });

  it('脱离容器调用 record 不会报错（非请求上下文，如定时任务）', () => {
    expect(() => recordBefore({ a: 1 })).not.toThrow();
    expect(buildSnapshotFields(undefined)).toEqual({ beforeData: null, afterData: null });
  });

  it('密码类字段脱敏为 ***（含嵌套与数组）', () => {
    const snapshot: OperationSnapshot = {};
    runWithSnapshot(snapshot, () => {
      recordAfter({
        username: 'admin',
        password: 'plain-text',
        roles: [{ roleName: '超管', newPassword: 'x' }],
      });
    });

    const parsed = JSON.parse(String(buildSnapshotFields(snapshot).afterData)) as Record<string, unknown>;
    expect(parsed.username).toBe('admin');
    expect(parsed.password).toBe('***');
    expect(JSON.stringify(parsed.roles)).toContain('***');
    expect(JSON.stringify(parsed)).not.toContain('plain-text');
  });

  it('空值保留为 null（能看出「清空了」这类动作），而不是被抹掉', () => {
    const snapshot: OperationSnapshot = {};
    runWithSnapshot(snapshot, () => {
      recordAfter({ email: null, phone: '' });
    });
    expect(buildSnapshotFields(snapshot).afterData).toBe('{"email":null,"phone":""}');
  });

  it('超长快照截断到上限并标注', () => {
    const snapshot: OperationSnapshot = {};
    const huge = 'x'.repeat(SNAPSHOT_MAX_CHARS + 500);
    runWithSnapshot(snapshot, () => {
      recordAfter({ remark: huge });
    });

    const text = String(buildSnapshotFields(snapshot).afterData);
    expect(text.length).toBeLessThanOrEqual(SNAPSHOT_MAX_CHARS + '…(truncated)'.length);
    expect(text.endsWith('…(truncated)')).toBe(true);
  });

  it('快照含 BigInt（Prisma id）不会崩，且转成数字落库', () => {
    const snapshot: OperationSnapshot = {};
    runWithSnapshot(snapshot, () => {
      // 服务层 recordAfter 常直接传 Prisma 行（id 是 BigInt）：
      // 未做转换时 JSON.stringify 会抛 TypeError，日志静默丢失
      recordBefore({ id: 1n, name: '旧值' });
      recordAfter({ id: 2n, name: '新值', nested: { id: 3n } });
    });

    const fields = buildSnapshotFields(snapshot);
    expect(fields.beforeData).toBe(JSON.stringify({ id: 1, name: '旧值' }));
    expect(fields.afterData).toBe(JSON.stringify({ id: 2, name: '新值', nested: { id: 3 } }));
  });

  it('未采集留痕时两侧都是 null（不写 {} 占位，避免前端误判"有留痕"）', () => {
    const snapshot: OperationSnapshot = {};
    runWithSnapshot(snapshot, () => {
      // 什么都不记
    });
    expect(buildSnapshotFields(snapshot)).toEqual({ beforeData: null, afterData: null });
  });
});
