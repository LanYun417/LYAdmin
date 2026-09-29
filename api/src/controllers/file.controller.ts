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

/** 校验内容哈希格式（SHA-256 十六进制 64 位）。 */
function assertValidHash(hash: string): void {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw AppError.badRequest('hash 非法，应为 SHA-256 十六进制（64 位）');
  }
}

/** 秒传预检：按内容哈希查询库内是否已存在相同文件。 */
export async function check(req: Request, res: Response): Promise<void> {
  const hash = String(req.query.hash ?? '').toLowerCase();
  assertValidHash(hash);
  const file = await fileService.checkFileByHash(hash);
  ok(res, { exists: file !== null, file });
}

/**
 * 下载文件。
 * 强制附件语义（Content-Disposition: attachment），浏览器一律下载而非内联打开；
 * 中文文件名由 Express 自动编码为 `filename*=UTF-8''...`。
 */
export async function download(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.badRequest('id 非法');
  }

  const file = await fileService.getFileForDownload(id);
  // 去掉 CR/LF 与引号，避免文件名污染响应头（响应头注入）
  const safeName = file.originName.replace(/[\r\n"]/g, '').trim() || `file-${id}`;

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  // res.download 内部走 sendFile：支持 Range、自动设置 Content-Length 与 Content-Disposition，
  // 出错时交由 Express 的错误处理链统一响应。
  res.download(file.absolutePath, safeName);
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
