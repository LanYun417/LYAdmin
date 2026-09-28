/**
 * 用户控制器。
 * 模块职责：解析用户模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as userService from '@/services/user.service';
import { ok } from '@/utils/response';
import type { CreateUserInput, UpdateUserInput } from '@/validators/user.validator';

/** 分页列表。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await userService.listUsers(req.query as Record<string, unknown>, req.user);
  ok(res, result);
}

/** 详情。 */
export async function detail(req: Request, res: Response): Promise<void> {
  const result = await userService.getUserDetail(Number(req.params.id));
  ok(res, result);
}

/** 新增。 */
export async function create(req: Request, res: Response): Promise<void> {
  const result = await userService.createUser(req.body as CreateUserInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function update(req: Request, res: Response): Promise<void> {
  const result = await userService.updateUser(Number(req.params.id), req.body as UpdateUserInput);
  ok(res, result, '编辑成功');
}

/** 删除。 */
export async function remove(req: Request, res: Response): Promise<void> {
  await userService.deleteUser(Number(req.params.id));
  ok(res, null, '删除成功');
}

/** 启用/禁用。 */
export async function changeStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: number };
  await userService.updateStatus(Number(req.params.id), status);
  ok(res, null, '状态更新成功');
}

/** 重置密码。 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { password } = req.body as { password: string };
  await userService.resetPassword(Number(req.params.id), password);
  ok(res, null, '密码重置成功');
}

/** 分配角色。 */
export async function assignRoles(req: Request, res: Response): Promise<void> {
  const { roleIds } = req.body as { roleIds: number[] };
  await userService.assignRoles(Number(req.params.id), roleIds);
  ok(res, null, '角色分配成功');
}
