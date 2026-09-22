/**
 * 菜单模块校验 schema。
 * 模块职责：菜单增改、列表查询的 zod 规则。
 */
import { z } from 'zod';

/** 列表查询。 */
export const menuListQuerySchema = z.object({
  menuName: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  tree: z.string().optional(),
});

/** 新增/编辑菜单。 */
export const menuUpsertSchema = z.object({
  parentId: z.coerce.number().int().min(0).default(0),
  menuName: z.string().trim().min(1, '菜单名称不能为空').max(50, '菜单名称过长'),
  menuType: z.enum(['M', 'C', 'F'], { message: '菜单类型必须为 M/C/F' }),
  path: z.string().trim().max(200, '路由路径过长').optional(),
  component: z.string().trim().max(255, '组件路径过长').optional(),
  icon: z.string().trim().max(100, '图标名过长').optional(),
  permission: z.string().trim().max(100, '权限标识过长').optional(),
  sort: z.number().int().min(0).default(0),
  visible: z.number().int().min(0).max(1).default(1),
  status: z.number().int().min(0).max(1).default(1),
  redirect: z.string().trim().max(255, '重定向过长').optional(),
  keepAlive: z.number().int().min(0).max(1).default(0),
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

export type MenuUpsertInput = z.infer<typeof menuUpsertSchema>;
