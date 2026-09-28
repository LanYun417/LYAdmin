/**
 * 部门模块校验 schema。
 * 模块职责：部门增改、列表查询的 zod 规则。
 */
import { z } from 'zod';

/** 列表查询。 */
export const deptListQuerySchema = z.object({
  deptName: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  tree: z.string().optional(),
});

/** 新增/编辑部门。 */
export const deptUpsertSchema = z.object({
  parentId: z.coerce.number().int().min(0).default(0),
  deptName: z.string().trim().min(1, '部门名称不能为空').max(50, '部门名称过长'),
  leader: z.string().trim().max(20, '负责人名称过长').optional(),
  phone: z.string().trim().max(20, '联系电话过长').optional(),
  email: z.union([z.string().trim().max(100, '邮箱过长'), z.literal('')]).optional(),
  sort: z.number().int().min(0).default(0),
  status: z.number().int().min(0).max(1).default(1),
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

export type DeptUpsertInput = z.infer<typeof deptUpsertSchema>;
