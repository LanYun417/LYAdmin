/**
 * 字典控制器。
 * 模块职责：解析字典模块请求参数、调用服务、组装统一响应。
 * 命名前缀 `type*` 对应字典类型、`item*` 对应字典项（同属 /api/dict 一个模块）。
 */
import type { Request, Response } from 'express';
import * as dictService from '@/services/dict.service';
import { ok } from '@/utils/response';
import type {
  CreateDictItemInput,
  CreateDictTypeInput,
  UpdateDictItemInput,
  UpdateDictTypeInput,
} from '@/validators/dict.validator';

/* ------------------------------ 字典类型 ------------------------------ */

/** 分页列表。 */
export async function typeList(req: Request, res: Response): Promise<void> {
  const result = await dictService.listDictTypes(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 新增。 */
export async function typeCreate(req: Request, res: Response): Promise<void> {
  const result = await dictService.createDictType(req.body as CreateDictTypeInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function typeUpdate(req: Request, res: Response): Promise<void> {
  const result = await dictService.updateDictType(Number(req.params.id), req.body as UpdateDictTypeInput);
  ok(res, result, '编辑成功');
}

/** 启用 / 禁用。 */
export async function typeSetStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: number };
  const result = await dictService.setDictTypeStatus(Number(req.params.id), status);
  ok(res, result, status === 1 ? '已启用' : '已禁用');
}

/** 删除（连带删除其下字典项）。 */
export async function typeRemove(req: Request, res: Response): Promise<void> {
  await dictService.deleteDictType(Number(req.params.id));
  ok(res, null, '删除成功');
}

/* ------------------------------ 字典项 ------------------------------ */

/** 分页列表（按 dictType 过滤）。 */
export async function itemList(req: Request, res: Response): Promise<void> {
  const result = await dictService.listDictItems(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 新增。 */
export async function itemCreate(req: Request, res: Response): Promise<void> {
  const result = await dictService.createDictItem(req.body as CreateDictItemInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function itemUpdate(req: Request, res: Response): Promise<void> {
  const result = await dictService.updateDictItem(Number(req.params.id), req.body as UpdateDictItemInput);
  ok(res, result, '编辑成功');
}

/** 启用 / 禁用。 */
export async function itemSetStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: number };
  const result = await dictService.setDictItemStatus(Number(req.params.id), status);
  ok(res, result, status === 1 ? '已启用' : '已禁用');
}

/** 删除。 */
export async function itemRemove(req: Request, res: Response): Promise<void> {
  await dictService.deleteDictItem(Number(req.params.id));
  ok(res, null, '删除成功');
}

/* ------------------------------ 业务取数 ------------------------------ */

/** 按类型编码取启用中的字典项（标签 + 值）。 */
export async function data(req: Request, res: Response): Promise<void> {
  const result = await dictService.getDictData(String(req.params.dictType));
  ok(res, result);
}
