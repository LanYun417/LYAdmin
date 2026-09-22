/**
 * 文件上传中间件（multer）。
 * 模块职责：磁盘存储 + 类型/大小/数量白名单校验，导出单文件/多文件中间件。
 */
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '@/config';
import { UPLOAD_ALLOWED_EXT, UPLOAD_ALLOWED_MIME } from '@/constants';
import { AppError } from '@/utils/response';

// 确保上传目录存在
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

/** 生成唯一存储文件名：时间戳 + 随机串 + 原扩展名。 */
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}_${random}${ext}`;
}

/** 磁盘存储引擎。 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    cb(null, generateFileName(file.originalname));
  },
});

/** 类型白名单校验。 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeAllowed = UPLOAD_ALLOWED_MIME.includes(file.mimetype);
  const extAllowed = UPLOAD_ALLOWED_EXT.includes(ext);
  if (!mimeAllowed || !extAllowed) {
    cb(AppError.badRequest(`不支持的文件类型: ${file.originalname}`));
    return;
  }
  cb(null, true);
};

/** multer 实例。 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: config.upload.maxCount,
  },
});

/** 单文件上传（字段名 `file`）。 */
export const uploadSingle = upload.single('file');

/** 多文件上传（字段名 `files`）。 */
export const uploadArray = upload.array('files', config.upload.maxCount);
