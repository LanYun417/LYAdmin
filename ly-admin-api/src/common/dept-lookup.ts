/**
 * 部门名解析工具（按 deptId 显式补查，替代 user → dept 关系）。
 *
 * 为什么不声明 Prisma 关系：`sys_user.dept_id` 使用「0 = 未分配」的哨兵约定，而 0 不在
 * `sys_dept` 中。若声明关系，Prisma 会生成外键约束，`dept_id = 0` 的写入会被 MySQL 直接拒绝，
 * 哨兵约定随之失效。故 schema 中不声明该关系，需要部门名的地方按 deptId 显式补查：
 * 部门存在取其名，deptId=0 或部门已删则返回 null。
 */
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * 查询单个部门名。
 * @param prisma Prisma 客户端
 * @param deptId 部门 id（0 或空值表示未分配）
 * @returns 部门名；未分配或部门不存在时为 null
 */
export async function lookupDeptName(
  prisma: PrismaService,
  deptId: bigint | number | null | undefined,
): Promise<string | null> {
  if (deptId === null || deptId === undefined) {
    return null;
  }
  const id = BigInt(deptId);
  if (id <= 0n) {
    return null;
  }
  const dept = await prisma.dept.findUnique({ where: { id }, select: { deptName: true } });
  return dept?.deptName ?? null;
}

/**
 * 批量查询部门名映射（key = 部门 id 的字符串形式），用于列表接口避免 N+1 查询。
 * @param prisma Prisma 客户端
 * @param deptIds 部门 id 列表（0 与空值会被忽略）
 * @returns id 字符串 → 部门名；无有效 id 时返回空 Map
 */
export async function lookupDeptNames(
  prisma: PrismaService,
  deptIds: Array<bigint | number | null | undefined>,
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(
      deptIds
        .filter((value): value is bigint | number => value !== null && value !== undefined)
        .map((value) => BigInt(value))
        .filter((value) => value > 0n),
    ),
  );
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await prisma.dept.findMany({
    where: { id: { in: ids } },
    select: { id: true, deptName: true },
  });
  return new Map(rows.map((row) => [String(row.id), row.deptName]));
}
