/**
 * 角色控制器。
 * 模块职责：解析角色模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as roleService from '@/services/role.service';
import { ok } from '@/utils/response';
import type { CreateRoleInput, UpdateRoleInput } from '@/validators/role.validator';

/** 分页列表。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await roleService.listRoles(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 全部角色（下拉）。 */
export async function all(_req: Request, res: Response): Promise<void> {
  const result = await roleService.listAllRoles();
  ok(res, result);
}

/** 新增。 */
export async function create(req: Request, res: Response): Promise<void> {
  const result = await roleService.createRole(req.body as CreateRoleInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function update(req: Request, res: Response): Promise<void> {
  const result = await roleService.updateRole(Number(req.params.id), req.body as UpdateRoleInput);
  ok(res, result, '编辑成功');
}

/** 删除。 */
export async function remove(req: Request, res: Response): Promise<void> {
  await roleService.deleteRole(Number(req.params.id));
  ok(res, null, '删除成功');
}

/** 角色已授权菜单 id。 */
export async function menus(req: Request, res: Response): Promise<void> {
  const result = await roleService.getRoleMenuIds(Number(req.params.id));
  ok(res, result);
}

/** 授权菜单。 */
export async function assignMenus(req: Request, res: Response): Promise<void> {
  const { menuIds } = req.body as { menuIds: number[] };
  await roleService.assignMenus(Number(req.params.id), menuIds);
  ok(res, null, '授权成功');
}
