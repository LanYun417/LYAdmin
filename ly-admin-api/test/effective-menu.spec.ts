import { describe, expect, it, vi } from 'vitest';
import {
  loadUserMenuOverrides,
  mergeEffectiveMenuIds,
  resolveEffectiveMenuIds,
} from '../src/common/auth/effective-menu.js';
import { UserMenuType } from '../src/common/config/constants.js';

describe('mergeEffectiveMenuIds', () => {
  it('有效菜单 = 角色菜单并集 ∪ 额外授予 − 额外撤销', () => {
    const result = mergeEffectiveMenuIds(
      [1, 2, 3],
      [
        { menuId: 4, type: UserMenuType.GRANT },
        { menuId: 2, type: UserMenuType.REVOKE },
      ],
    );
    expect([...result].sort((a, b) => a - b)).toEqual([1, 3, 4]);
  });

  it('撤销优先于授予：同一菜单既授予又撤销时，最终为撤销', () => {
    const result = mergeEffectiveMenuIds(
      [],
      [
        { menuId: 9, type: UserMenuType.GRANT },
        { menuId: 9, type: UserMenuType.REVOKE },
      ],
    );
    expect(result.has(9)).toBe(false);
  });

  it('撤销一个角色里本就没有的菜单也不报错（幂等删除）', () => {
    const result = mergeEffectiveMenuIds([1], [{ menuId: 99, type: UserMenuType.REVOKE }]);
    expect([...result]).toEqual([1]);
  });
});

describe('resolveEffectiveMenuIds', () => {
  it('合并角色菜单与用户覆盖，并回报 hasOverride', async () => {
    const roleMenuFindMany = vi.fn().mockResolvedValue([{ menuId: 1n }, { menuId: 2n }]);
    const userMenuFindMany = vi.fn().mockResolvedValue([
      { menuId: 3n, type: UserMenuType.GRANT },
      { menuId: 1n, type: UserMenuType.REVOKE },
    ]);
    const prisma = { roleMenu: { findMany: roleMenuFindMany }, userMenu: { findMany: userMenuFindMany } } as never;

    const result = await resolveEffectiveMenuIds(prisma, 7, [10, 11]);

    expect([...result.menuIds].sort((a, b) => a - b)).toEqual([2, 3]);
    expect(result.hasOverride).toBe(true);
    // 角色 id 转成 bigint 再查
    expect(roleMenuFindMany.mock.calls[0][0].where.roleId.in).toEqual([10n, 11n]);
    // 覆盖按 userId 查
    expect(userMenuFindMany.mock.calls[0][0].where.userId).toBe(7n);
  });

  it('无角色且无覆盖时返回空集合、hasOverride=false', async () => {
    const roleMenuFindMany = vi.fn();
    const prisma = {
      roleMenu: { findMany: roleMenuFindMany },
      userMenu: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    const result = await resolveEffectiveMenuIds(prisma, 7, []);
    expect(result.menuIds.size).toBe(0);
    expect(result.hasOverride).toBe(false);
    // 无角色时不应查 roleMenu
    expect(roleMenuFindMany).not.toHaveBeenCalled();
  });
});

describe('loadUserMenuOverrides', () => {
  it('把 bigint menuId 归一为 number', async () => {
    const prisma = { userMenu: { findMany: vi.fn().mockResolvedValue([{ menuId: 5n, type: 1 }]) } } as never;
    const rows = await loadUserMenuOverrides(prisma, 1);
    expect(rows).toEqual([{ menuId: 5, type: 1 }]);
  });
});
