/**
 * 角色服务。
 * 模块职责：角色分页/下拉查询、CRUD、菜单授权（唯一操作 Role/RoleMenu/RoleDept 的层）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { DataScope, Status, SUPER_ADMIN_ROLE } from '../../common/config/constants.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';
import { recordAfter, recordBefore } from '../../common/log/operation-snapshot.js';
import { runBatchDelete, type BatchDeleteResult } from '../../common/utils/batch.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SEED_ROLE_CODES, resetSeedRoleMenus } from '../../prisma/seed.service.js';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js';

/** 角色简要信息（下拉 & 列表复用）。 */
export interface RoleBrief {
  id: number;
  roleName: string;
  roleCode: string;
  status: number;
  sort: number;
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope: number;
  /** 自定义部门 id 列表（仅 dataScope=2 时非空） */
  deptIds: number[];
}

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
  ) {}

  /** 将 Prisma Role 记录转换为简要信息。 */
  private toRoleBrief(
    role: { id: bigint; roleName: string; roleCode: string; status: number; sort: number; dataScope: number | null },
    deptIds: number[] = [],
  ): RoleBrief {
    return {
      id: Number(role.id),
      roleName: role.roleName,
      roleCode: role.roleCode,
      status: Number(role.status),
      sort: Number(role.sort),
      dataScope: Number(role.dataScope ?? DataScope.ALL),
      deptIds,
    };
  }

  /** 取单个角色的自定义部门 id（变更留痕用，避免为此再写一段查询）。 */
  private async listRoleDeptIds(roleId: number): Promise<number[]> {
    const map = await this.loadDeptIdsByRoleIds([roleId]);
    return map.get(roleId) ?? [];
  }

  /** 批量加载角色的自定义部门 id（按 roleId 分组）。 */
  private async loadDeptIdsByRoleIds(roleIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (roleIds.length === 0) {
      return map;
    }
    const rows = await this.prisma.roleDept.findMany({
      where: { roleId: { in: roleIds } },
      select: { roleId: true, deptId: true },
    });
    rows.forEach((row) => {
      const roleId = Number(row.roleId);
      const list = map.get(roleId) ?? [];
      list.push(Number(row.deptId));
      map.set(roleId, list);
    });
    return map;
  }

  /** 同步角色的自定义部门（仅 dataScope=2 时保留，其余情况清空）。 */
  private async syncRoleDepts(roleId: number, dataScope: number, deptIds: number[]): Promise<void> {
    await this.prisma.roleDept.deleteMany({ where: { roleId: BigInt(roleId) } });
    if (dataScope !== DataScope.CUSTOM) {
      return;
    }
    const unique = Array.from(new Set(deptIds));
    if (unique.length > 0) {
      await this.prisma.roleDept.createMany({
        data: unique.map((deptId) => ({ roleId: BigInt(roleId), deptId: BigInt(deptId) })),
      });
    }
  }

  /** 分页查询角色。 */
  async listRoles(query: Record<string, unknown>): Promise<PageResult<RoleBrief>> {
    const { page, pageSize, offset, limit } = parsePagination(query);

    const roleName = readString(query.roleName);
    const status = readNumber(query.status);
    const where = {
      ...(roleName ? { roleName: { contains: roleName } } : {}),
      ...(status !== undefined ? { status } : {}),
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.role.count({ where }),
    ]);

    const deptIdsMap = await this.loadDeptIdsByRoleIds(rows.map((role) => Number(role.id)));
    return buildPageResult(
      rows.map((role) => this.toRoleBrief(role, deptIdsMap.get(Number(role.id)) ?? [])),
      count,
      page,
      pageSize,
    );
  }

  /** 查询全部角色（下拉用）。 */
  async listAllRoles(): Promise<RoleBrief[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const deptIdsMap = await this.loadDeptIdsByRoleIds(roles.map((role) => Number(role.id)));
    return roles.map((role) => this.toRoleBrief(role, deptIdsMap.get(Number(role.id)) ?? []));
  }

  /** 新增角色。 */
  async createRole(input: CreateRoleDto): Promise<RoleBrief> {
    const exists = await this.prisma.role.findUnique({ where: { roleCode: input.roleCode } });
    if (exists) {
      throw AppException.conflict('角色编码已存在');
    }
    const role = await this.prisma.role.create({
      data: {
        roleName: input.roleName,
        roleCode: input.roleCode,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        dataScope: input.dataScope ?? DataScope.ALL,
        remark: input.remark || null,
      },
    });
    const deptIds = input.dataScope === DataScope.CUSTOM ? Array.from(new Set(input.deptIds ?? [])) : [];
    await this.syncRoleDepts(Number(role.id), input.dataScope ?? DataScope.ALL, deptIds);
    return this.toRoleBrief(role, deptIds);
  }

  /** 编辑角色。 */
  async updateRole(id: number, input: UpdateRoleDto): Promise<RoleBrief> {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(id) } });
    if (!role) {
      throw AppException.notFound('角色不存在');
    }
    // 内置超管角色不可禁用（与「不可删除」一致，避免管理端误操作）
    if (role.roleCode === SUPER_ADMIN_ROLE && (input.status ?? Status.ENABLED) === Status.DISABLED) {
      throw AppException.conflict('内置超级管理员角色不可禁用');
    }
    const dataScope = input.dataScope ?? DataScope.ALL;
    // 变更留痕：数据权限范围与部门集合一起记，方便追溯"某角色能看到哪些部门"
    recordBefore({
      roleName: role.roleName,
      roleCode: role.roleCode,
      sort: Number(role.sort),
      status: Number(role.status),
      dataScope: Number(role.dataScope),
      remark: role.remark,
      deptIds: await this.listRoleDeptIds(id),
    });
    await this.prisma.role.update({
      where: { id: BigInt(id) },
      data: {
        roleName: input.roleName,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        dataScope,
        remark: input.remark || null,
      },
    });
    const deptIds = dataScope === DataScope.CUSTOM ? Array.from(new Set(input.deptIds ?? [])) : [];
    await this.syncRoleDepts(id, dataScope, deptIds);
    recordAfter({
      roleName: input.roleName,
      roleCode: role.roleCode,
      sort: input.sort ?? 0,
      status: input.status ?? 1,
      dataScope,
      remark: input.remark || null,
      deptIds,
    });
    // 角色信息变更：清空鉴权缓存（角色可能被多个用户持有，影响面广）
    this.authCache.invalidate();
    return this.toRoleBrief(role, deptIds);
  }

  /** 删除角色（内置超管角色不可删，存在关联用户时不可删）。 */
  async deleteRole(id: number): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(id) } });
    if (!role) {
      throw AppException.notFound('角色不存在');
    }
    if (role.roleCode === SUPER_ADMIN_ROLE) {
      throw AppException.conflict('内置超级管理员角色不可删除');
    }
    const userCount = await this.prisma.userRole.count({ where: { roleId: BigInt(id) } });
    if (userCount > 0) {
      throw AppException.conflict('该角色下存在用户，无法删除');
    }
    await this.prisma.roleMenu.deleteMany({ where: { roleId: BigInt(id) } });
    await this.prisma.roleDept.deleteMany({ where: { roleId: BigInt(id) } });
    await this.prisma.role.delete({ where: { id: BigInt(id) } });
    // 角色删除：清空鉴权缓存（防御性，确保不再残留该角色相关权限）
    this.authCache.invalidate();
  }

  /**
   * 批量删除角色。
   * 逐条复用 `deleteRole`（继承内置角色保护、「角色下有用户不可删」两条护栏），失败只记原因不中断。
   */
  async batchDeleteRoles(ids: number[]): Promise<BatchDeleteResult> {
    const rows = await this.prisma.role.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, roleName: true },
    });
    const nameMap = new Map(rows.map((row) => [Number(row.id), row.roleName]));
    return runBatchDelete(
      ids,
      (id) => this.deleteRole(id),
      (id) => nameMap.get(id) ?? `#${id}`,
    );
  }

  /** 查询角色已授权菜单 id 列表。 */
  async getRoleMenuIds(id: number): Promise<number[]> {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(id) } });
    if (!role) {
      throw AppException.notFound('角色不存在');
    }
    const records = await this.prisma.roleMenu.findMany({
      where: { roleId: BigInt(id) },
      select: { menuId: true },
    });
    return records.map((record) => Number(record.menuId));
  }

  /**
   * 授权角色菜单（先清后建）。
   *
   * 两处必须注意的地方：
   * 1. **两条写操作必须在同一个事务里**。原先 `deleteMany` 与 `createMany` 是两条独立语句，
   *    只要后者失败（并发下菜单被删导致外键报错、连接中断等），该角色的授权会被**清空且不恢复**，
   *    而调用方只看到一次 500——授权数据静默丢失，属于必须修掉的 bug。
   * 2. 先校验 menuId 都存在，把"脏 id"变成**明确的 400**，而不是让数据库外键报错（前端只会看到 500）。
   *    校验与写入之间仍有并发窗口，所以事务不能省。
   */
  async assignMenus(id: number, menuIds: number[]): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(id) } });
    if (!role) {
      throw AppException.notFound('角色不存在');
    }

    const unique = Array.from(new Set(menuIds));
    if (unique.length > 0) {
      const existing = await this.prisma.menu.findMany({
        where: { id: { in: unique.map((menuId) => BigInt(menuId)) } },
        select: { id: true },
      });
      if (existing.length !== unique.length) {
        const existingIds = new Set(existing.map((menu) => Number(menu.id)));
        const missing = unique.filter((menuId) => !existingIds.has(menuId));
        throw AppException.badRequest(`以下菜单不存在，可能已被删除，请刷新后重试：${missing.join('、')}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roleMenu.deleteMany({ where: { roleId: BigInt(id) } });
      if (unique.length > 0) {
        await tx.roleMenu.createMany({
          data: unique.map((menuId) => ({ roleId: BigInt(id), menuId: BigInt(menuId) })),
        });
      }
    });

    // 角色菜单授权变更 → 权限码集合变化：清空鉴权缓存（影响所有持有该角色的用户）
    this.authCache.invalidate();
  }

  /**
   * 按种子定义重建角色的菜单授权（管理端「恢复默认授权」）。
   *
   * 与启动种子的分工：启动种子只负责**首次创建**角色并写授权，绝不覆盖已有授权
   * （否则运维调好的权限会在重启 / 部署时被静默回滚）；需要重置时由运维在这里显式触发。
   *
   * @param roleIds 目标角色 id；传空数组 = 全部种子角色
   * @returns 成功重建的角色（含授权条数）与被跳过的角色（含原因）
   */
  async resetMenusToSeed(roleIds: number[]): Promise<{
    reset: Array<{ id: number; roleName: string; count: number }>;
    skipped: Array<{ id: number; roleName: string; reason: string }>;
  }> {
    const reset: Array<{ id: number; roleName: string; count: number }> = [];
    const skipped: Array<{ id: number; roleName: string; reason: string }> = [];

    if (roleIds.length === 0) {
      const result = await resetSeedRoleMenus(this.prisma);
      result.forEach((item) => reset.push({ id: item.id, roleName: item.roleName, count: item.count }));
    } else {
      const seedCodes = new Set(SEED_ROLE_CODES);
      const rows = await this.prisma.role.findMany({
        where: { id: { in: roleIds.map((id) => BigInt(id)) } },
        select: { id: true, roleCode: true, roleName: true },
      });
      const byId = new Map(rows.map((row) => [Number(row.id), row]));

      for (const id of roleIds) {
        const role = byId.get(id);
        if (!role) {
          skipped.push({ id, roleName: `#${id}`, reason: '角色不存在' });
          continue;
        }
        if (!seedCodes.has(role.roleCode)) {
          // 自定义角色没有种子定义，谈不上"恢复默认"
          skipped.push({ id, roleName: role.roleName, reason: '非种子角色，没有可恢复的默认授权' });
          continue;
        }
        const [one] = await resetSeedRoleMenus(this.prisma, role.roleCode);
        reset.push({ id, roleName: role.roleName, count: one?.count ?? 0 });
      }
    }

    // 菜单授权变化 → 权限码与菜单树都可能变，且可能一次涉及多个角色：全清最稳妥
    this.authCache.invalidate();
    return { reset, skipped };
  }
}
