/**
 * 字典模块校验 schema。
 * 模块职责：字典类型 / 字典项的增改、启停用、列表查询与 id 参数的 zod 规则。
 */
import { z } from 'zod';

/** 状态：1 启用 / 0 禁用。 */
const statusSchema = z.number().int().min(0).max(1);

/** 字典类型编码：字母开头，2~100 位字母/数字/下划线（业务引用键）。 */
const dictTypeCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{1,99}$/, '字典类型编码为字母开头，2~100 位字母/数字/下划线');

/** 类型列表查询。 */
export const dictTypeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  dictName: z.string().trim().optional(),
  dictType: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

/** 新增字典类型。 */
export const createDictTypeSchema = z.object({
  dictName: z.string().trim().min(1, '字典名称不能为空').max(100, '字典名称过长'),
  dictType: dictTypeCodeSchema,
  status: statusSchema.default(1),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 编辑字典类型（类型编码不可修改，故不含 dictType）。 */
export const updateDictTypeSchema = z.object({
  dictName: z.string().trim().min(1, '字典名称不能为空').max(100, '字典名称过长'),
  status: statusSchema.default(1),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 字典项列表查询（dictType 为必填的所属类型）。 */
export const dictItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  dictType: dictTypeCodeSchema,
  dictLabel: z.string().trim().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

/** 新增字典项。 */
export const createDictItemSchema = z.object({
  dictType: dictTypeCodeSchema,
  dictLabel: z.string().trim().min(1, '字典标签不能为空').max(100, '字典标签过长'),
  dictValue: z.string().trim().min(1, '字典值不能为空').max(100, '字典值过长'),
  sort: z.number().int().min(0).max(9999).default(0),
  status: statusSchema.default(1),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 编辑字典项（所属类型不可修改）。 */
export const updateDictItemSchema = z.object({
  dictLabel: z.string().trim().min(1, '字典标签不能为空').max(100, '字典标签过长'),
  dictValue: z.string().trim().min(1, '字典值不能为空').max(100, '字典值过长'),
  sort: z.number().int().min(0).max(9999).default(0),
  status: statusSchema.default(1),
  remark: z.string().max(255, '备注过长').optional(),
});

/** 启停用（类型 / 项通用）。 */
export const dictStatusSchema = z.object({
  status: statusSchema,
});

/** id 参数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('id 必须为正整数'),
});

/** 按类型取字典数据的路径参数。 */
export const dictTypeParamSchema = z.object({
  dictType: dictTypeCodeSchema,
});

export type CreateDictTypeInput = z.infer<typeof createDictTypeSchema>;
export type UpdateDictTypeInput = z.infer<typeof updateDictTypeSchema>;
export type CreateDictItemInput = z.infer<typeof createDictItemSchema>;
export type UpdateDictItemInput = z.infer<typeof updateDictItemSchema>;
