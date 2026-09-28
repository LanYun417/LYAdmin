/**
 * 角色模块校验 schema。
 * 模块职责：角色增改、授权、列表查询的 zod 规则。
 */
import { z } from 'zod';

/** 列表查询。 */
export const roleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  roleName: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

/** 新增角色。 */
export const createRoleSchema = z.object({
  roleName: z.string().trim().min(1, '角色名称不能为空').max(50, '角色名称过长'),
  roleCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{1,49}$/, '角色编码为字母开头，2~50 位字母/数字/下划线'),
  sort: z.number().int().min(0).default(0),
  status: z.number().int().min(0).max(1).default(1),
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope: z.number().int().min(1).max(4).default(1),
  /** 自定义部门 id 列表（dataScope=2 时生效） */
  deptIds: z.array(z.coerce.number().int().positive()).default([]),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 编辑角色。 */
export const updateRoleSchema = z.object({
  roleName: z.string().trim().min(1, '角色名称不能为空').max(50, '角色名称过长'),
  sort: z.number().int().min(0).default(0),
  status: z.number().int().min(0).max(1).default(1),
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope: z.number().int().min(1).max(4).default(1),
  /** 自定义部门 id 列表（dataScope=2 时生效） */
  deptIds: z.array(z.coerce.number().int().positive()).default([]),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 授权菜单。 */
export const assignMenuSchema = z.object({
  menuIds: z.array(z.coerce.number().int().positive()).default([]),
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
