/**
 * 代码生成控制器。
 * 模块职责：接收代码生成请求、调用服务、返回统一响应或 ZIP 二进制流。
 */
import type { Request, Response } from 'express';
import * as genService from '@/services/gen.service';
import type { GenConfig } from '@/services/gen.service';
import { createGenCode } from '@/services/gen.writer';
import { ok } from '@/utils/response';

/** 数据库物理表列表。 */
export async function listTables(_req: Request, res: Response): Promise<void> {
  const tables = await genService.listGenTables();
  ok(res, tables);
}

/** 指定表的字段结构详情。 */
export async function tableDetail(req: Request, res: Response): Promise<void> {
  const tableName = String(req.params.tableName ?? '');
  const detail = await genService.getGenTableDetail(tableName);
  ok(res, detail);
}

/** 在线预览生成的代码（返回文件列表）。 */
export async function preview(req: Request, res: Response): Promise<void> {
  const result = await genService.previewGenCode(req.body as GenConfig);
  ok(res, result);
}

/** 生成并下载代码（ZIP 二进制流）。 */
export async function download(req: Request, res: Response): Promise<void> {
  const { filename, buffer } = await genService.buildGenZip(req.body as GenConfig);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

/** 生成代码并直接写入项目目录（含自动接线）。 */
export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as GenConfig & { overwrite?: boolean };
  const result = await createGenCode(body, body.overwrite === true);
  ok(res, result, '代码已生成到项目');
}
