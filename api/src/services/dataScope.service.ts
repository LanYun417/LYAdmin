/**
 * 数据权限（数据范围）服务。
 * 模块职责：依据当前用户角色的数据范围配置，计算其可见的数据行集合（部门集合 / 仅本人 / 全部）。
 *
 * 设计要点：
 * - 仅超管（`SUPER_ADMIN_ROLE`）或任一角色为「全部」时返回全部，不做裁剪；
 * - 「自定义部门 / 本部门及以下」需把所选部门及其全部下级纳入可见集合（基于部门树）；
 * - 「仅本人」限制到当前用户自身；
 * - 多角色取并集：任一角色为「全部」即视为全部；否则合并各角色的部门集合，无部门集合时若含「仅本人」则限制本人。
 */
import { Op } from 'sequelize';
import { DataScope, SUPER_ADMIN_ROLE } from '@/constants';
import { Dept, Role, RoleDept } from '@/models';
import { buildTree, collectIds, type TreeItem, type WithChildren } from '@/utils/tree';
import type { AuthUserContext } from '@/types';

/** 数据范围计算结果。 */
export type DataScopeResult = { mode: 'all' } | { mode: 'dept'; deptIds: number[] } | { mode: 'self'; userId: number };

/** 部门扁平节点（仅供建树）。 */
interface DeptFlat extends TreeItem {
  id: number;
  parentId: number;
  sort: number;
}

/**
 * 在树中按 id 查找节点。
 */
function findNode(nodes: WithChildren<DeptFlat>[], id: number): WithChildren<DeptFlat> | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = findNode(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * 收集给定根部门的「自身 + 全部后代」id 集合。
 * @param rootIds 根部门 id 列表
 * @returns 去重后的部门 id 集合（含根）
 */
async function collectDescendantIds(rootIds: number[]): Promise<number[]> {
  if (rootIds.length === 0) {
    return [];
  }
  const depts = await Dept.findAll({ order: [['id', 'ASC']] });
  const tree = buildTree<DeptFlat>(
    depts.map((dept) => ({
      id: Number(dept.id),
      parentId: Number(dept.parentId),
      sort: Number(dept.sort),
    })),
  );

  const result = new Set<number>();
  for (const rootId of rootIds) {
    const node = findNode(tree, rootId);
    if (node) {
      collectIds([node]).forEach((id) => result.add(id));
    }
  }
  return [...result];
}

/**
 * 计算当前用户的数据范围。
 * @param authUser 鉴权上下文（含角色编码、部门 id、用户 id）
 * @returns 数据范围结果
 */
export async function getDataScope(authUser: AuthUserContext): Promise<DataScopeResult> {
  if (authUser.roles.includes(SUPER_ADMIN_ROLE)) {
    return { mode: 'all' };
  }
  // 无任何角色：与权限码的 fail-closed 哲学一致，收敛为「仅本人」而不是放开全部
  if (authUser.roles.length === 0) {
    return { mode: 'self', userId: authUser.userId };
  }

  const roles = await Role.findAll({
    where: { roleCode: { [Op.in]: authUser.roles } },
    include: [{ model: RoleDept, attributes: ['deptId'], required: false }],
  });

  const deptIdSet = new Set<number>();
  let selfFlag = false;

  for (const role of roles) {
    const scope = Number(role.dataScope ?? DataScope.ALL);
    if (scope === DataScope.ALL) {
      return { mode: 'all' };
    }
    if (scope === DataScope.SELF) {
      selfFlag = true;
      continue;
    }
    if (scope === DataScope.CUSTOM) {
      const customIds = (role.roleDepts ?? []).map((rd) => Number(rd.deptId));
      (await collectDescendantIds(customIds)).forEach((id) => deptIdSet.add(id));
    } else if (scope === DataScope.DEPT_AND_CHILD) {
      (await collectDescendantIds([authUser.deptId])).forEach((id) => deptIdSet.add(id));
    }
  }

  if (deptIdSet.size > 0) {
    return { mode: 'dept', deptIds: [...deptIdSet] };
  }
  if (selfFlag) {
    return { mode: 'self', userId: authUser.userId };
  }
  return { mode: 'all' };
}
