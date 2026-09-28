/**
 * 系统参数模块校验 schema。
 * 模块职责：参数增改、列表查询、键名查询的 zod 规则。
 */
import { z } from 'zod';

/** 列表查询。 */
export const configListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  configName: z.string().trim().optional(),
  configKey: z.string().trim().optional(),
});

/** 新增参数。configKey 即业务引用键，创建后不可修改。 */
export const createConfigSchema = z.object({
  configName: z.string().trim().min(1, '参数名称不能为空').max(100, '参数名称过长'),
  configKey: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9._]{1,99}$/, '参数键名为字母开头，2~100 位字母/数字/点/下划线'),
  configValue: z.string().max(500, '参数值过长').default(''),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 编辑参数（不含 configKey，键名创建后不可修改）。 */
export const updateConfigSchema = z.object({
  configName: z.string().trim().min(1, '参数名称不能为空').max(100, '参数名称过长'),
  configValue: z.string().max(500, '参数值过长').default(''),
  remark: z.string().max(255, '备注过长').optional(),
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

/** 键名参数。 */
export const configKeyParamSchema = z.object({
  configKey: z.string().trim().min(1, '参数键名不能为空').max(100, '参数键名过长'),
});

export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
