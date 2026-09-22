/**
 * 文件服务。
 * 模块职责：上传文件落库、文件列表查询、文件删除（唯一操作 File 模型的层）。
 */
import fs from 'fs';
import path from 'path';
import { Op, type WhereOptions } from 'sequelize';
import { config } from '@/config';
import { File } from '@/models';
import type { PageResult } from '@/types';
import { buildPageResult, parsePagination } from '@/utils/pagination';
import { AppError } from '@/utils/response';

/** 文件列表项。 */
export interface FileItem {
  id: number;
  originName: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  uploaderId: number | null;
  createdAt: Date;
}

/**
 * 修正 multer 原始文件名的 latin1→utf8 编码问题。
 * @param name 原始文件名
 */
function decodeOriginalName(name: string): string {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? name : decoded;
  } catch {
    return name;
  }
}

/** 将 File 实例转换为列表项。 */
function toFileItem(file: File): FileItem {
  return {
    id: Number(file.id),
    originName: file.originName,
    fileName: file.fileName,
    filePath: file.filePath,
    fileUrl: file.fileUrl,
    mimeType: file.mimeType,
    size: Number(file.size),
    uploaderId: file.uploaderId === null ? null : Number(file.uploaderId),
    createdAt: file.createdAt,
  };
}

/**
 * 保存上传文件元信息。
 * @param files multer 文件数组
 * @param uploaderId 上传人 id
 * @returns 文件列表项数组
 */
export async function saveFiles(files: Express.Multer.File[], uploaderId: number | null): Promise<FileItem[]> {
  const items: FileItem[] = [];

  for (const file of files) {
    const originName = decodeOriginalName(file.originalname);
    const relativePath = path.join(config.upload.dirName, file.filename).replace(/\\/g, '/');
    const fileUrl = `/${config.upload.dirName}/${file.filename}`;

    const record = await File.create({
      originName,
      fileName: file.filename,
      filePath: relativePath,
      fileUrl,
      mimeType: file.mimetype,
      size: file.size,
      uploaderId,
    });

    items.push(toFileItem(record));
  }

  return items;
}

/**
 * 分页查询文件列表。
 * @param query 查询参数（page/pageSize/originName）
 */
export async function listFiles(query: Record<string, unknown>): Promise<PageResult<FileItem>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const originName = typeof query.originName === 'string' ? query.originName.trim() : '';
  if (originName) {
    where.originName = { [Op.like]: `%${originName}%` };
  }

  const { rows, count } = await File.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset,
    limit,
  });

  return buildPageResult(rows.map(toFileItem), count, page, pageSize);
}

/**
 * 删除文件（同时移除磁盘文件）。
 * @param id 文件 id
 */
export async function deleteFile(id: number): Promise<void> {
  const record = await File.findByPk(id);
  if (!record) {
    throw AppError.notFound('文件不存在');
  }

  const absolutePath = path.isAbsolute(record.filePath)
    ? record.filePath
    : path.resolve(config.rootDir, record.filePath);

  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      console.error('[FileService] 删除磁盘文件失败:', error);
    }
  }

  await record.destroy();
}
