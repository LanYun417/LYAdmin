/**
 * 系统参数控制器。
 * 模块职责：解析参数模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as configService from '@/services/config.service';
import { ok } from '@/utils/response';
import type { CreateConfigInput, UpdateConfigInput } from '@/validators/config.validator';

/** 分页列表。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await configService.listConfigs(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 详情。 */
export async function detail(req: Request, res: Response): Promise<void> {
  const result = await configService.getConfigDetail(Number(req.params.id));
  ok(res, result);
}

/** 按键取值（业务取数，仅需登录）。 */
export async function data(req: Request, res: Response): Promise<void> {
  const result = await configService.getConfigData(String(req.params.configKey));
  ok(res, result);
}

/** 新增。 */
export async function create(req: Request, res: Response): Promise<void> {
  const result = await configService.createConfig(req.body as CreateConfigInput);
  ok(res, result, '新增成功');
}

/** 编辑。 */
export async function update(req: Request, res: Response): Promise<void> {
  const result = await configService.updateConfig(Number(req.params.id), req.body as UpdateConfigInput);
  ok(res, result, '编辑成功');
}

/** 删除。 */
export async function remove(req: Request, res: Response): Promise<void> {
  await configService.deleteConfig(Number(req.params.id));
  ok(res, null, '删除成功');
}
