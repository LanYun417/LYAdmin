/**
 * 角色服务。
 * 模块职责：角色分页/下拉查询、CRUD、菜单授权（唯一操作 Role/RoleMenu/RoleDept 的层）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app.exception.js';
import { AuthCacheService } from '../../common/auth-cache.service.js';
import { DataScope, Status, SUPER_ADMIN_ROLE } from '../../common/constants.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils.js';
import type { PageResult } from '../../common/types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
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

  /** 授权角色菜单（先清后建）。 */
  async assignMenus(id: number, menuIds: number[]): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(id) } });
    if (!role) {
      throw AppException.notFound('角色不存在');
    }
    await this.prisma.roleMenu.deleteMany({ where: { roleId: BigInt(id) } });
    const unique = Array.from(new Set(menuIds));
    if (unique.length > 0) {
      await this.prisma.roleMenu.createMany({
        data: unique.map((menuId) => ({ roleId: BigInt(id), menuId: BigInt(menuId) })),
      });
    }
    // 角色菜单授权变更 → 权限码集合变化：清空鉴权缓存（影响所有持有该角色的用户）
    this.authCache.invalidate();
  }
}
