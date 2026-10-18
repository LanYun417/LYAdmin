/**
 * 上传 multer 配置（磁盘存储 + 类型/大小/数量白名单）。
 * 模块职责：files 模块与 profile 头像上传复用同一份配置，避免白名单漂移。
 * 说明：采用 diskStorage，上传文件先落盘到 `UPLOAD_DIR/<扩展名分组>/`，再由 FilesService
 * 做幻数校验与秒传去重；分组规则见 storage-layout.ts（目录名即小写扩展名）。
 */
import multer from 'multer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Express } from 'express';
import { AppException } from '../exception/app.exception.js';
import { config } from '../config/config.js';
import { UPLOAD_ALLOWED_EXT, UPLOAD_ALLOWED_MIME } from '../config/constants.js';
import { extensionFolder } from './storage-layout.js';

const storage = multer.diskStorage({
  // 按扩展名分组落盘：fileFilter 先于本回调执行，此处 ext 已通过白名单校验
  destination: (_req, file, cb) => {
    const dir = path.join(config.upload.dir, extensionFolder(path.extname(file.originalname)));
    try {
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error instanceof Error ? error : new Error(String(error)), '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = Math.random().toString(36).slice(2, 10);
    cb(null, `${Date.now()}_${random}${ext}`);
  },
});

const fileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeAllowed = UPLOAD_ALLOWED_MIME.includes(file.mimetype);
  const extAllowed = UPLOAD_ALLOWED_EXT.includes(ext);
  if (!mimeAllowed || !extAllowed) {
    cb(AppException.badRequest(`不支持的文件类型: ${file.originalname}`), false);
    return;
  }
  cb(null, true);
};

/** 上传 multer 配置（files 与 profile 头像共用）。 */
export const UPLOAD_MULTER_OPTIONS = {
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSize, files: config.upload.maxCount },
};
