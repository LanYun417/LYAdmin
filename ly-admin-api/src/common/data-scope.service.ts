/**
 * 数据权限服务（RBAC 增强）。
 * 模块职责：依据用户所属角色的 dataScope 计算可见数据范围，供列表查询注入过滤条件。
 * 迁移自原 Express 版本的 services/dataScope.service.ts。
 *
 * 返回判别联合（discriminated union），由调用方翻译成 Prisma where 条件：
 * - `{ mode:'all' }`  → 不加过滤
 * - `{ mode:'dept', deptIds }` → `deptId in deptIds`
 * - `{ mode:'self', userId }` → `id = userId`
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DataScope, SUPER_ADMIN_ROLE } from './constants.js';
import { buildTree, collectIds, findNode } from './utils.js';
import type { AuthUserContext } from './types.js';

/** 数据范围结果。 */
export type DataScopeResult = { mode: 'all' } | { mode: 'dept'; deptIds: number[] } | { mode: 'self'; userId: number };

@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 收集指定部门及其全部下级部门 id。
   *
   * 实现：一次性加载整张 dept 表 → 内存建树 → DFS 收集（与原实现一致）。
   * rootId 不存在于树中时静默跳过。
   *
   * @param rootIds 起始部门 id 列表
   */
  private async collectDescendantIds(rootIds: number[]): Promise<number[]> {
    if (rootIds.length === 0) {
      return [];
    }
    // 一次性拉取整张 dept 表，按 id 升序
    const depts = await this.prisma.dept.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, parentId: true, sort: true },
    });
    const tree = buildTree(
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
   * 计算数据权限范围。
   *
   * 流程（与原实现严格一致）：
   * ① 超管短路 → all；
   * ② 无角色 → **fail-closed 收敛为 self**（而非放开全部）；
   * ③ 任一角色 dataScope=ALL → 立即 all（短路，多角色并集）；
   * ④ 累积 CUSTOM / DEPT_AND_CHILD 的部门集合；
   * ⑤ 收敛：部门集合非空 → dept（**dept 优先于 self**）；否则有 SELF 角色 → self；
   *    否则兜底 all。
   */
  async getDataScope(authUser: AuthUserContext): Promise<DataScopeResult> {
    // ① 超管短路
    if (authUser.roles.includes(SUPER_ADMIN_ROLE)) {
      return { mode: 'all' };
    }
    // ② 无角色：按最小权限原则收敛为「仅本人」
    if (authUser.roles.length === 0) {
      return { mode: 'self', userId: authUser.userId };
    }

    // ③ 查角色 + 其自定义部门
    const roles = await this.prisma.role.findMany({
      where: { roleCode: { in: authUser.roles } },
      include: { roleDepts: { select: { deptId: true } } },
    });

    const deptIdSet = new Set<number>();
    let selfFlag = false;

    for (const role of roles) {
      const scope = Number(role.dataScope ?? DataScope.ALL);
      // 任一角色为「全部」→ 立即全放行
      if (scope === DataScope.ALL) {
        return { mode: 'all' };
      }
      if (scope === DataScope.SELF) {
        selfFlag = true;
        continue;
      }
      if (scope === DataScope.CUSTOM) {
        // 自定义部门：取该角色授权的部门并展开子树
        const rootIds = (role.roleDepts ?? []).map((rd) => Number(rd.deptId));
        const expanded = await this.collectDescendantIds(rootIds);
        expanded.forEach((id) => deptIdSet.add(id));
        continue;
      }
      if (scope === DataScope.DEPT_AND_CHILD) {
        // 本部门及以下：以**当前登录用户**的部门为起点（不是角色配置里的）
        const expanded = await this.collectDescendantIds([authUser.deptId]);
        expanded.forEach((id) => deptIdSet.add(id));
      }
    }

    // ⑤ 收敛：部门集合优先于 self
    if (deptIdSet.size > 0) {
      return { mode: 'dept', deptIds: [...deptIdSet] };
    }
    if (selfFlag) {
      return { mode: 'self', userId: authUser.userId };
    }
    return { mode: 'all' };
  }
}
