/**
 * 部门服务。
 * 模块职责：部门 CRUD、树构建（唯一操作 Dept/RoleDept 的层）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app.exception.js';
import { DataScopeService } from '../../common/data-scope.service.js';
import { buildTree, readNumber, readString } from '../../common/utils.js';
import type { DeptNode } from '../../common/types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DeptUpsertDto } from './dto/dept.dto.js';

@Injectable()
export class DeptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  /** 将 Prisma Dept 记录转换为部门节点。 */
  private toDeptNode(dept: {
    id: bigint;
    parentId: bigint;
    deptType: number;
    deptName: string;
    sort: number;
    status: number;
    leader: string | null;
    phone: string | null;
    email: string | null;
  }): DeptNode {
    return {
      id: Number(dept.id),
      parentId: Number(dept.parentId),
      deptType: Number(dept.deptType),
      deptName: dept.deptName,
      sort: Number(dept.sort),
      status: Number(dept.status),
      leader: dept.leader,
      phone: dept.phone,
      email: dept.email,
    };
  }

  /** 查询部门列表（可选返回树）。 */
  async listDepts(query: Record<string, unknown>): Promise<DeptNode[]> {
    const deptName = readString(query.deptName);
    const status = readNumber(query.status);
    const where = {
      ...(deptName ? { deptName: { contains: deptName } } : {}),
      ...(status !== undefined ? { status } : {}),
    };

    const depts = await this.prisma.dept.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const nodes = depts.map((dept) => this.toDeptNode(dept));

    const treeFlag = readString(query.tree);
    const wantTree = treeFlag === '1' || treeFlag === 'true';
    return wantTree ? buildTree(nodes) : nodes;
  }

  /** 完整部门树（供上级选择）。 */
  async getDeptTree(): Promise<DeptNode[]> {
    const depts = await this.prisma.dept.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return buildTree(depts.map((dept) => this.toDeptNode(dept)));
  }

  /** 部门详情。 */
  async getDeptDetail(id: number): Promise<DeptNode> {
    const dept = await this.prisma.dept.findUnique({ where: { id: BigInt(id) } });
    if (!dept) {
      throw AppException.notFound('部门不存在');
    }
    return this.toDeptNode(dept);
  }

  /** 新增部门 / 岗位。 */
  async createDept(input: DeptUpsertDto): Promise<DeptNode> {
    const parentId = input.parentId ?? 0;
    if (parentId !== 0) {
      const parent = await this.prisma.dept.findUnique({
        where: { id: BigInt(parentId) },
        select: { id: true, deptType: true },
      });
      if (!parent) {
        throw AppException.badRequest('上级部门不存在');
      }
      // 岗位为叶子节点，不能再挂下级：禁止把岗位设为上级
      if (parent.deptType === 2) {
        throw AppException.badRequest('上级不能为岗位');
      }
    }

    const dept = await this.prisma.dept.create({
      data: {
        parentId: BigInt(parentId),
        deptType: input.deptType,
        deptName: input.deptName,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        leader: input.leader || null,
        phone: input.phone || null,
        email: input.email || null,
      },
    });
    this.dataScope.invalidateDeptCache();
    return this.toDeptNode(dept);
  }

  /** 编辑部门。 */
  async updateDept(id: number, input: DeptUpsertDto): Promise<DeptNode> {
    const dept = await this.prisma.dept.findUnique({ where: { id: BigInt(id) } });
    if (!dept) {
      throw AppException.notFound('部门不存在');
    }
    // 类型创建后不可修改：避免部门↔岗位互改导致其下岗位/子部门归属错乱
    if (Number(dept.deptType) !== input.deptType) {
      throw AppException.badRequest('类型创建后不可修改');
    }
    const parentId = input.parentId ?? 0;
    if (parentId === id) {
      throw AppException.badRequest('上级部门不能为自身');
    }
    if (parentId !== 0) {
      const parent = await this.prisma.dept.findUnique({
        where: { id: BigInt(parentId) },
        select: { id: true, deptType: true },
      });
      if (!parent) {
        throw AppException.badRequest('上级部门不存在');
      }
      // 岗位为叶子节点，不能再挂下级：禁止把岗位设为上级
      if (parent.deptType === 2) {
        throw AppException.badRequest('上级不能为岗位');
      }
      const descendants = await this.collectDescendantIds(id);
      if (descendants.includes(parentId)) {
        throw AppException.badRequest('上级部门不能为自身子级');
      }
    }

    const updated = await this.prisma.dept.update({
      where: { id: BigInt(id) },
      data: {
        parentId: BigInt(parentId),
        deptType: input.deptType,
        deptName: input.deptName,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        leader: input.leader || null,
        phone: input.phone || null,
        email: input.email || null,
      },
    });
    this.dataScope.invalidateDeptCache();
    return this.toDeptNode(updated);
  }

  /** 收集指定部门的全部后代 id（广度优先逐层下钻）。 */
  private async collectDescendantIds(id: number): Promise<number[]> {
    const result: number[] = [];
    let currentLevel: bigint[] = [BigInt(id)];

    while (currentLevel.length > 0) {
      const children = await this.prisma.dept.findMany({
        where: { parentId: { in: currentLevel } },
        select: { id: true },
      });
      const childIds = children.map((child) => child.id);
      if (childIds.length === 0) {
        break;
      }
      result.push(...childIds.map(Number));
      currentLevel = childIds;
    }

    return result;
  }

  /** 删除部门（存在子级或部门下仍有用户时拒绝；连带清理角色的「自定义部门」授权）。 */
  async deleteDept(id: number): Promise<void> {
    const dept = await this.prisma.dept.findUnique({ where: { id: BigInt(id) } });
    if (!dept) {
      throw AppException.notFound('部门不存在');
    }
    const childCount = await this.prisma.dept.count({ where: { parentId: BigInt(id) } });
    if (childCount > 0) {
      throw AppException.conflict('存在子部门，请先删除子部门');
    }
    const userCount = await this.prisma.user.count({ where: { deptId: BigInt(id) } });
    if (userCount > 0) {
      throw AppException.conflict('该部门下存在用户，请先转移用户再删除');
    }
    // sys_role_dept 含真实外键约束，删除部门前必须先清理授权，否则会触发数据库级外键错误
    await this.prisma.roleDept.deleteMany({ where: { deptId: BigInt(id) } });
    await this.prisma.dept.delete({ where: { id: BigInt(id) } });
    this.dataScope.invalidateDeptCache();
  }
}
