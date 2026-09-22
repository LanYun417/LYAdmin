/**
 * 文件控制器。
 * 模块职责：解析文件模块请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as fileService from '@/services/file.service';
import { AppError, ok } from '@/utils/response';

/** 上传（单/多文件）。 */
export async function upload(req: Request, res: Response): Promise<void> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? (req.file ? [req.file] : []);
  if (files.length === 0) {
    throw AppError.badRequest('未接收到文件');
  }
  const result = await fileService.saveFiles(files, req.user?.userId ?? null);
  ok(res, result, '上传成功');
}

/** 文件列表。 */
export async function list(req: Request, res: Response): Promise<void> {
  const result = await fileService.listFiles(req.query as Record<string, unknown>);
  ok(res, result);
}

/** 删除文件。 */
export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.badRequest('id 非法');
  }
  await fileService.deleteFile(id);
  ok(res, null, '删除成功');
}
