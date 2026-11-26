/**
 * 数据导入服务单测（Queue / Notice / Prisma 全部 mock）。
 * 覆盖：类型注册与查询、空文件/未知类型/空数据/超行数拒绝、入队幂等键构造。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET = 'import-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'import-test-refresh-secret-not-for-production-2';

const { ImportService, IMPORT_MAX_ROWS } = await import('../src/common/queue/import/import.service.js');

describe('ImportService', () => {
  let service: InstanceType<typeof ImportService>;
  let enqueued: Array<Record<string, unknown>>;
  let notice: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    enqueued = [];
    notice = { publish: vi.fn(async () => 1) };
    const queue = {
      enqueue: vi.fn(async (input: Record<string, unknown>) => {
        enqueued.push(input);
        return { id: 1, ...input };
      }),
      registerHandler: vi.fn(),
    };
    service = new ImportService({} as never, queue as never, notice as never);
  });

  it('listTypes：仅返回已注册类型', () => {
    service.register('users', '用户', async () => ({ total: 1, created: 1, failed: [] }));
    expect(service.listTypes()).toEqual([{ type: 'users', title: '用户' }]);
  });

  it('submit：未知类型 / 空文件 / 无数据行 / 超行数全部拒绝', async () => {
    await expect(service.submit('nope', { buffer: Buffer.from('a'), originalname: 'a.csv' }, 1)).rejects.toThrow(
      /未知的导入类型/,
    );
    service.register('users', '用户', async () => ({ total: 1, created: 1, failed: [] }));
    await expect(service.submit('users', { buffer: Buffer.alloc(0), originalname: 'a.csv' }, 1)).rejects.toThrow(
      /文件为空/,
    );
    await expect(service.submit('users', { buffer: Buffer.from('\uFEFF'), originalname: 'a.csv' }, 1)).rejects.toThrow(
      /没有有效数据行/,
    );
    const big = `h\r\n${'x\r\n'.repeat(IMPORT_MAX_ROWS + 10)}`;
    await expect(service.submit('users', { buffer: Buffer.from(big), originalname: 'a.csv' }, 1)).rejects.toThrow(
      /不得超过/,
    );
  });

  it('submit：合法文件入队，幂等键为 import:type:userId:内容哈希（同内容同键）', async () => {
    service.register('users', '用户', async () => ({ total: 2, created: 2, failed: [] }));
    const csv = '账号,昵称\r\na,n1\r\nb,n2\r\n';
    const first = await service.submit('users', { buffer: Buffer.from(csv), originalname: 'u.csv' }, 7);
    expect(first.jobId).toBe(1);
    expect(enqueued).toHaveLength(1);
    const firstKey = enqueued[0].idemKey as string;
    expect(firstKey).toMatch(/^import:users:7:[0-9a-f]{16}$/);

    // 同用户同内容再提交：键相同（队列侧据此去重）
    await service.submit('users', { buffer: Buffer.from(csv), originalname: 'u.csv' }, 7);
    expect(enqueued[1].idemKey).toBe(firstKey);

    // 不同用户：键不同
    await service.submit('users', { buffer: Buffer.from(csv), originalname: 'u.csv' }, 8);
    expect(enqueued[2].idemKey).not.toBe(firstKey);
  });

  it('register：同时注册队列处理器（type 前缀 import.）', () => {
    const registerHandler = vi.fn();
    const queue = { enqueue: vi.fn(), registerHandler };
    const svc = new ImportService({} as never, queue as never, notice as never);
    const handler = async (): Promise<{ total: number; created: number; failed: never[] }> => ({
      total: 0,
      created: 0,
      failed: [],
    });
    svc.register('dept', '部门', handler);
    expect(registerHandler).toHaveBeenCalledWith('import.dept', expect.any(Function));
  });
});
