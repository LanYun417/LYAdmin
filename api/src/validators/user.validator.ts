/**
 * 用户模块校验 schema。
 * 模块职责：用户增改、状态、重置密码、分配角色、列表查询的 zod 规则。
 */
import { z } from 'zod';
import { REGEX } from '@/constants';

/** 列表查询。 */
export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  username: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  deptId: z.coerce.number().int().min(0).optional(),
});

/** 新增用户。 */
export const createUserSchema = z.object({
  username: z.string().trim().regex(REGEX.USERNAME, '账号为 3~20 位字母、数字或下划线'),
  password: z.string().min(6, '密码至少 6 位').max(20, '密码最多 20 位'),
  nickname: z.string().trim().min(1, '昵称不能为空').max(50, '昵称过长'),
  email: z.union([z.string().regex(REGEX.EMAIL, '邮箱格式不正确'), z.literal('')]).optional(),
  phone: z.union([z.string().regex(REGEX.PHONE, '手机号格式不正确'), z.literal('')]).optional(),
  /** 性别：字典 sys_user_sex 的值（1 男 / 2 女 / 0 未知），空串表示未设置 */
  gender: z.union([z.string().trim().max(20, '性别值过长'), z.literal('')]).optional(),
  status: z.number().int().min(0).max(1).default(1),
  roleIds: z.array(z.coerce.number().int().positive()).default([]),
  /** 部门 id（0 表示未分配） */
  deptId: z.coerce.number().int().min(0).default(0),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 编辑用户。 */
export const updateUserSchema = z.object({
  nickname: z.string().trim().min(1, '昵称不能为空').max(50, '昵称过长'),
  email: z.union([z.string().regex(REGEX.EMAIL, '邮箱格式不正确'), z.literal('')]).optional(),
  phone: z.union([z.string().regex(REGEX.PHONE, '手机号格式不正确'), z.literal('')]).optional(),
  /** 性别：字典 sys_user_sex 的值（1 男 / 2 女 / 0 未知），空串表示未设置 */
  gender: z.union([z.string().trim().max(20, '性别值过长'), z.literal('')]).optional(),
  status: z.number().int().min(0).max(1).default(1),
  roleIds: z.array(z.coerce.number().int().positive()).default([]),
  /** 部门 id（0 表示未分配） */
  deptId: z.coerce.number().int().min(0).default(0),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 启用/禁用。 */
export const userStatusSchema = z.object({
  status: z.number().int().min(0).max(1),
});

/** 重置密码。 */
export const resetPasswordSchema = z.object({
  password: z.string().min(6, '密码至少 6 位').max(20, '密码最多 20 位'),
});

/** 分配角色。 */
export const assignRoleSchema = z.object({
  roleIds: z.array(z.coerce.number().int().positive()).default([]),
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
