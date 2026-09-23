/**
 * 文件服务。
 * 模块职责：上传文件落库、文件列表查询、文件删除（唯一操作 File 模型的层）。
 */
import crypto from 'crypto';
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
  hash: string | null;
  uploaderId: number | null;
  createdAt: Date;
  /** 本次保存是否复用了既有物理文件（秒传/去重），仅响应时携带 */
  deduplicated?: boolean;
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
    hash: file.hash ?? null,
    uploaderId: file.uploaderId === null ? null : Number(file.uploaderId),
    createdAt: file.createdAt,
  };
}

/** 解析物理文件的绝对路径。 */
function resolvePhysicalPath(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.resolve(config.rootDir, relativePath);
}

/**
 * 流式计算文件 SHA-256（避免大文件整体载入内存）。
 * @param absolutePath 物理文件绝对路径
 */
function computeSha256(absolutePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
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
    const absolutePath = path.isAbsolute(file.path) ? file.path : path.resolve(config.rootDir, file.path);
    const hash = await computeSha256(absolutePath);

    // 内容去重：同哈希物理文件已存在 → 秒传。
    // 删除本次上传的物理文件，新记录复用既有 filePath/fileUrl；
    // 引用计数不落库，删除时按同 filePath 行数动态判断是否删盘。
    const existing = await File.findOne({ where: { hash }, order: [['id', 'ASC']] });

    if (existing) {
      try {
        fs.rmSync(absolutePath, { force: true });
      } catch (error) {
        console.error('[FileService] 清理重复上传的物理文件失败:', error);
      }

      const record = await File.create({
        originName,
        fileName: existing.fileName,
        filePath: existing.filePath,
        fileUrl: existing.fileUrl,
        mimeType: file.mimetype,
        size: file.size,
        uploaderId,
        hash,
      });

      items.push({ ...toFileItem(record), deduplicated: true });
      continue;
    }

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
      hash,
    });

    items.push(toFileItem(record));
  }

  return items;
}

/**
 * 按内容哈希查询已存在的文件（秒传预检）。
 * @param hash SHA-256 十六进制（64 位小写）
 * @returns 已存在时返回最早的一条引用记录，否则 null
 */
export async function checkFileByHash(hash: string): Promise<FileItem | null> {
  const record = await File.findOne({ where: { hash }, order: [['id', 'ASC']] });
  return record ? toFileItem(record) : null;
}

/**
 * 秒传：不接收文件体，按哈希复用既有物理文件，仅创建新的引用记录。
 * @param hash SHA-256 十六进制
 * @param originName 本次上传使用的原始文件名
 * @param uploaderId 上传人 id
 */
export async function instantUpload(hash: string, originName: string, uploaderId: number | null): Promise<FileItem> {
  const existing = await File.findOne({ where: { hash }, order: [['id', 'ASC']] });
  if (!existing) {
    throw AppError.notFound('库中不存在相同内容的文件，无法秒传');
  }

  const record = await File.create({
    originName,
    fileName: existing.fileName,
    filePath: existing.filePath,
    fileUrl: existing.fileUrl,
    mimeType: existing.mimeType,
    size: Number(existing.size),
    uploaderId,
    hash,
  });

  return { ...toFileItem(record), deduplicated: true };
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
 * 删除文件。
 * 引用计数语义：若同一物理路径（filePath）还有其他引用记录，仅删本条记录；
 * 本条是最后引用时才删除磁盘文件，避免秒传复用的物理文件被误删。
 * @param id 文件 id
 */
export async function deleteFile(id: number): Promise<void> {
  const record = await File.findByPk(id);
  if (!record) {
    throw AppError.notFound('文件不存在');
  }

  const sameRefCount = await File.count({ where: { filePath: record.filePath } });
  await record.destroy();

  if (sameRefCount > 1) {
    return;
  }

  const absolutePath = resolvePhysicalPath(record.filePath);

  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      console.error('[FileService] 删除磁盘文件失败:', error);
    }
  }
}
