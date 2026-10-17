import { describe, expect, it, vi } from 'vitest';
import { AuthCacheService } from '../src/common/auth-cache.service.js';
import { DataScopeService } from '../src/common/data-scope.service.js';
import { HttpLogQueueService } from '../src/common/http-log-queue.service.js';

/** 构造一条满足 createMany 形状的访问日志（仅测试用，字段值不参与断言）。 */
function httpLogRecord() {
  return {
    time: new Date(),
    method: 'GET',
    url: '/api/test',
    statusCode: 200,
    duration: 1,
    ip: null,
    userAgent: null,
    userId: 1n,
    username: 'admin',
    deptId: 0n,
    deptName: null,
    query: {},
    reqBody: null,
    resBody: null,
  } as never;
}

describe('HttpLogQueueService', () => {
  it('合并多次 enqueue，flush 时一次 createMany 写入', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new HttpLogQueueService({ httpLog: { createMany } } as never);

    service.enqueue(httpLogRecord());
    service.enqueue(httpLogRecord());
    expect(createMany).not.toHaveBeenCalled();

    await service.flush();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data).toHaveLength(2);

    await service.onModuleDestroy();
  });

  it('达到阈值立即刷盘', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 50 });
    const service = new HttpLogQueueService({ httpLog: { createMany } } as never);

    for (let i = 0; i < 50; i += 1) {
      service.enqueue(httpLogRecord());
    }
    // enqueue 内部以 void 触发，等待微任务队列让 createMany 落地
    await Promise.resolve();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data).toHaveLength(50);

    await service.onModuleDestroy();
  });
});

describe('AuthCacheService 菜单树缓存', () => {
  it('可写入/读取，并在全量 invalidate 后清空', () => {
    const cache = new AuthCacheService();
    const tree = [{ id: 1, parentId: 0, menuName: '首页', menuType: 'C' }] as never;

    cache.setMenuTree('super', tree);
    expect(cache.getMenuTree('super')).toBe(tree);

    cache.invalidate();
    expect(cache.getMenuTree('super')).toBeNull();
  });
});

describe('DataScopeService 部门结构缓存', () => {
  it('连续计算只加载一次部门表，invalidate 后重新加载', async () => {
    const deptFindMany = vi.fn().mockResolvedValue([{ id: 1n, parentId: 0n, sort: 0 }]);
    const roleFindMany = vi.fn().mockResolvedValue([{ dataScope: 3, roleDepts: [] }]);
    const service = new DataScopeService({
      dept: { findMany: deptFindMany },
      role: { findMany: roleFindMany },
    } as never);
    const user = {
      userId: 1,
      username: 'u',
      roles: ['r'],
      permissions: [],
      status: 1,
      deptId: 1,
      deptName: null,
      tokenIat: 0,
    } as never;

    await service.getDataScope(user);
    await service.getDataScope(user);
    expect(deptFindMany).toHaveBeenCalledTimes(1);

    service.invalidateDeptCache();
    await service.getDataScope(user);
    expect(deptFindMany).toHaveBeenCalledTimes(2);
  });
});
