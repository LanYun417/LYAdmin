/**
 * 部门服务。
 * 模块职责：部门 CRUD、树构建（唯一操作 Dept 的层）。
 */
import { Op, type WhereOptions } from 'sequelize';
import { Dept } from '@/models';
import { buildTree } from '@/utils/tree';
import { AppError } from '@/utils/response';
import type { DeptNode } from '@/types';
import type { DeptUpsertInput } from '@/validators/dept.validator';

/** 将 Dept 实例转换为部门节点。 */
export function toDeptNode(dept: Dept): DeptNode {
  return {
    id: Number(dept.id),
    parentId: Number(dept.parentId),
    deptName: dept.deptName,
    sort: Number(dept.sort),
    status: Number(dept.status),
    leader: dept.leader,
    phone: dept.phone,
    email: dept.email,
  };
}

/**
 * 查询部门列表（可选返回树）。
 * @param query 查询参数（deptName/status/tree）
 */
export async function listDepts(query: Record<string, unknown>): Promise<DeptNode[]> {
  const where: WhereOptions = {};

  const deptName = typeof query.deptName === 'string' ? query.deptName.trim() : '';
  if (deptName) {
    where.deptName = { [Op.like]: `%${deptName}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const depts = await Dept.findAll({
    where,
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const nodes = depts.map(toDeptNode);

  const treeFlag = String(query.tree ?? '');
  const wantTree = treeFlag === '1' || treeFlag === 'true';
  return wantTree ? buildTree(nodes) : nodes;
}

/** 完整部门树（供上级选择）。 */
export async function getDeptTree(): Promise<DeptNode[]> {
  const depts = await Dept.findAll({
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return buildTree(depts.map(toDeptNode));
}

/** 部门详情。 */
export async function getDeptDetail(id: number): Promise<DeptNode> {
  const dept = await Dept.findByPk(id);
  if (!dept) {
    throw AppError.notFound('部门不存在');
  }
  return toDeptNode(dept);
}

/** 新增部门。 */
export async function createDept(input: DeptUpsertInput): Promise<DeptNode> {
  if (input.parentId !== 0) {
    const parent = await Dept.findByPk(input.parentId);
    if (!parent) {
      throw AppError.badRequest('上级部门不存在');
    }
  }

  const dept = await Dept.create({
    parentId: input.parentId,
    deptName: input.deptName,
    sort: input.sort,
    status: input.status,
    leader: input.leader || null,
    phone: input.phone || null,
    email: input.email || null,
  });
  return toDeptNode(dept);
}

/** 编辑部门。 */
export async function updateDept(id: number, input: DeptUpsertInput): Promise<DeptNode> {
  const dept = await Dept.findByPk(id);
  if (!dept) {
    throw AppError.notFound('部门不存在');
  }
  if (input.parentId === id) {
    throw AppError.badRequest('上级部门不能为自身');
  }
  if (input.parentId !== 0) {
    const parent = await Dept.findByPk(input.parentId);
    if (!parent) {
      throw AppError.badRequest('上级部门不存在');
    }
    const descendants = await collectDescendantIds(id);
    if (descendants.includes(input.parentId)) {
      throw AppError.badRequest('上级部门不能为自身子级');
    }
  }

  await dept.update({
    parentId: input.parentId,
    deptName: input.deptName,
    sort: input.sort,
    status: input.status,
    leader: input.leader || null,
    phone: input.phone || null,
    email: input.email || null,
  });
  return toDeptNode(dept);
}

/** 收集指定部门的全部后代 id。 */
async function collectDescendantIds(id: number): Promise<number[]> {
  const result: number[] = [];
  let currentLevel: number[] = [id];

  while (currentLevel.length > 0) {
    const children = await Dept.findAll({
      where: { parentId: { [Op.in]: currentLevel } },
      attributes: ['id'],
    });
    const childIds = children.map((child) => Number(child.id));
    if (childIds.length === 0) {
      break;
    }
    result.push(...childIds);
    currentLevel = childIds;
  }

  return result;
}

/** 删除部门（存在子级时拒绝）。 */
export async function deleteDept(id: number): Promise<void> {
  const dept = await Dept.findByPk(id);
  if (!dept) {
    throw AppError.notFound('部门不存在');
  }
  const childCount = await Dept.count({ where: { parentId: id } });
  if (childCount > 0) {
    throw AppError.conflict('存在子部门，请先删除子部门');
  }
  await dept.destroy();
}
