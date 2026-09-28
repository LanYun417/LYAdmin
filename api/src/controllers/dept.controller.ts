/**
 * 部门控制器。
 * 模块职责：解析部门模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as deptService from '@/services/dept.service';
import { ok } from '@/utils/response';
import type { DeptUpsertInput } from '@/validators/dept.validator';

/** 列表（可树形）。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await deptService.listDepts(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 完整部门树。 */
export async function tree(_req: Request, res: Response): Promise<void> {
  const result = await deptService.getDeptTree();
  ok(res, result);
}

/** 详情。 */
export async function detail(req: Request, res: Response): Promise<void> {
  const result = await deptService.getDeptDetail(Number(req.params.id));
  ok(res, result);
}

/** 新增。 */
export async function create(req: Request, res: Response): Promise<void> {
  const result = await deptService.createDept(req.body as DeptUpsertInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function update(req: Request, res: Response): Promise<void> {
  const result = await deptService.updateDept(Number(req.params.id), req.body as DeptUpsertInput);
  ok(res, result, '编辑成功');
}

/** 删除。 */
export async function remove(req: Request, res: Response): Promise<void> {
  await deptService.deleteDept(Number(req.params.id));
  ok(res, null, '删除成功');
}
