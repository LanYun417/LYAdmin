/**
 * 菜单控制器。
 * 模块职责：解析菜单模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as menuService from '@/services/menu.service';
import { ok } from '@/utils/response';
import type { MenuUpsertInput } from '@/validators/menu.validator';

/** 列表（可树形）。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await menuService.listMenus(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 完整菜单树。 */
export async function tree(_req: Request, res: Response): Promise<void> {
  const result = await menuService.getMenuTree();
  ok(res, result);
}

/** 详情。 */
export async function detail(req: Request, res: Response): Promise<void> {
  const result = await menuService.getMenuDetail(Number(req.params.id));
  ok(res, result);
}

/** 新增。 */
export async function create(req: Request, res: Response): Promise<void> {
  const result = await menuService.createMenu(req.body as MenuUpsertInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function update(req: Request, res: Response): Promise<void> {
  const result = await menuService.updateMenu(Number(req.params.id), req.body as MenuUpsertInput);
  ok(res, result, '编辑成功');
}

/** 删除。 */
export async function remove(req: Request, res: Response): Promise<void> {
  await menuService.deleteMenu(Number(req.params.id));
  ok(res, null, '删除成功');
}
