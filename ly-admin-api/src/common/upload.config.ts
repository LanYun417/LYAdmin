/**
 * 上传 multer 配置（磁盘存储 + 类型/大小/数量白名单）。
 * 模块职责：files 模块与 profile 头像上传复用同一份配置，避免白名单漂移。
 * 说明：采用 diskStorage，上传文件先落盘到 config.upload.dir，再由 FilesService 做幻数校验与秒传去重。
 */
import multer from 'multer';
import path from 'node:path';
import type { Express } from 'express';
import { AppException } from './app.exception.js';
import { config } from './config.js';
import { UPLOAD_ALLOWED_EXT, UPLOAD_ALLOWED_MIME } from './constants.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.upload.dir),
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
