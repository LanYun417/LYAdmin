import { describe, expect, it, vi } from 'vitest';
import { resetSeedRoleMenus, seedRole } from '../src/prisma/seed.service.js';

/** 构造一个只关心 role / roleMenu / menu 的最小 prisma 假对象。 */
function fakePrisma() {
  return {
    role: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    roleMenu: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    // resetSeedRoleMenus 会先跑 seedMenu 补建缺失节点；这里让 findFirst 直接命中，避免 create
    menu: {
      findFirst: vi.fn().mockResolvedValue({ id: 1n }),
      create: vi.fn(),
    },
  };
}

describe('seedRole（启动种子）', () => {
  it('角色已存在 → 完全不碰它的授权（修复"重启即丢"）', async () => {
    const prisma = fakePrisma();
    prisma.role.findUnique.mockResolvedValue({ id: 1n });

    const stat = await seedRole(prisma as never, new Map([['dashboard', 10]]));

    expect(stat).toEqual({ created: 0, skipped: 3 });
    expect(prisma.role.create).not.toHaveBeenCalled();
    // 关键断言：绝不清空、绝不重建已有角色的授权
    expect(prisma.roleMenu.deleteMany).not.toHaveBeenCalled();
    expect(prisma.roleMenu.createMany).not.toHaveBeenCalled();
  });

  it('角色不存在 → 创建并按种子写授权', async () => {
    const prisma = fakePrisma();
    prisma.role.findUnique.mockResolvedValue(null);
    prisma.role.create.mockResolvedValue({ id: 5n });
    const menuIdMap = new Map([
      ['dashboard', 10],
      ['system', 11],
      ['log:http:export', 12],
    ]);

    const stat = await seedRole(prisma as never, menuIdMap);

    expect(stat).toEqual({ created: 3, skipped: 0 });
    expect(prisma.role.create).toHaveBeenCalledTimes(3);
    expect(prisma.roleMenu.deleteMany).toHaveBeenCalledTimes(3);
    expect(prisma.roleMenu.createMany).toHaveBeenCalledTimes(3);

    const calls = prisma.roleMenu.createMany.mock.calls.map((call) => call[0].data);
    // ROLE_SEEDS 顺序：super_admin(ALL) → admin → viewer
    // super_admin 的 'ALL' 展开成菜单表全量
    expect(calls[0].map((row: { menuId: bigint }) => Number(row.menuId))).toEqual([10, 11, 12]);
    // viewer 只勾了 dashboard/system/log:http（没有 log:http:export）→ 映射后 2 条，
    // 证明 menuKeys 是按 key 查表、查不到的 key 被过滤而不是塞 undefined
    expect(calls[2].map((row: { menuId: bigint }) => Number(row.menuId))).toEqual([10, 11]);
  });
});

describe('resetSeedRoleMenus（恢复默认授权）', () => {
  it('指定 roleCode → 只重建该角色', async () => {
    const prisma = fakePrisma();
    prisma.role.findUnique.mockResolvedValue({ id: 7n, roleName: '只读访客' });

    const result = await resetSeedRoleMenus(prisma as never, 'viewer');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 7, roleCode: 'viewer', roleName: '只读访客' });
    expect(prisma.role.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.role.findUnique.mock.calls[0][0].where.roleCode).toBe('viewer');
    // 显式重置是"先清后建"的覆盖语义
    expect(prisma.roleMenu.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.roleMenu.createMany).toHaveBeenCalledTimes(1);
  });

  it('不传 roleCode → 重建全部种子角色', async () => {
    const prisma = fakePrisma();
    prisma.role.findUnique.mockResolvedValue({ id: 1n, roleName: 'x' });

    const result = await resetSeedRoleMenus(prisma as never);

    expect(result).toHaveLength(3);
    expect(prisma.roleMenu.deleteMany).toHaveBeenCalledTimes(3);
  });

  it('角色不存在 → 跳过，且不清授权（不顺手创建角色）', async () => {
    const prisma = fakePrisma();
    prisma.role.findUnique.mockResolvedValue(null);

    const result = await resetSeedRoleMenus(prisma as never, 'viewer');

    expect(result).toHaveLength(0);
    expect(prisma.role.create).not.toHaveBeenCalled();
    expect(prisma.roleMenu.deleteMany).not.toHaveBeenCalled();
  });
});
