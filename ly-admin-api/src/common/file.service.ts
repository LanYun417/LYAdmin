/**
 * 文件服务：上传（含哈希秒传预检）、列表查询、删除。
 * 模块职责：落盘 + 写 sys_file 元信息，并提供秒传与白名单校验。
 */
import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { AppException } from './app.exception.js';
import { config } from './config.js';
import { UPLOAD_ALLOWED_EXT, UPLOAD_ALLOWED_MIME } from './constants.js';
import { sha256 } from './utils.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 文件记录（对外返回，不含内部路径细节）。 */
export interface FileItem {
  id: number;
  originName: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  hash: string | null;
  uploaderId: number | null;
  createdAt: Date;
}

/** 上传返回结果。 */
export interface UploadResult {
  /** 本次为「秒传命中」，未重复落盘 */
  duplicated: boolean;
  file: FileItem;
}

/** 校验并归一化上传文件。 */
function validateUpload(originalName: string, mimeType: string): { ext: string; base: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!UPLOAD_ALLOWED_EXT.includes(ext)) {
    throw AppException.badRequest(`不支持的文件类型: ${ext || '未知'}`);
  }
  if (!UPLOAD_ALLOWED_MIME.includes(mimeType)) {
    throw AppException.badRequest(`不支持的文件 MIME 类型: ${mimeType}`);
  }
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { ext, base };
}

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  /** 确保上传目录存在。 */
  private ensureUploadDir(): void {
    if (!existsSync(config.upload.dir)) {
      mkdirSync(config.upload.dir, { recursive: true });
    }
  }

  /**
   * 按内容哈希查询已存在文件（秒传预检）。
   *
   * 前端可在真正上传前先算 SHA-256 询问是否已存在，避免重复流量与存储。
   */
  async findByHash(hash: string): Promise<FileItem | null> {
    const record = await this.prisma.file.findFirst({
      where: { hash },
      orderBy: { id: 'desc' },
    });
    return record ? this.toFileItem(record) : null;
  }

  /**
   * 保存一个上传文件。
   *
   * @param originalName 原始文件名
   * @param mimeType MIME
   * @param buffer 文件内容
   * @param uploaderId 上传人 id（可为空，如种子数据）
   */
  async save(
    originalName: string,
    mimeType: string,
    buffer: Buffer,
    uploaderId: number | null = null,
  ): Promise<UploadResult> {
    const { ext, base } = validateUpload(originalName, mimeType);

    // 内容哈希 → 秒传：已存在相同内容则直接复用记录
    const hash = sha256(buffer);
    const existing = await this.prisma.file.findFirst({ where: { hash }, orderBy: { id: 'desc' } });
    if (existing) {
      return { duplicated: true, file: this.toFileItem(existing) };
    }

    this.ensureUploadDir();
    const fileName = `${base}${ext}`;
    const filePath = path.join(config.upload.dir, fileName);
    await fsp.writeFile(filePath, buffer);

    const fileUrl = `/${config.upload.route}/${fileName}`;
    const record = await this.prisma.file.create({
      data: {
        originName: originalName.slice(0, 255),
        fileName,
        filePath: path.join(config.upload.dirName, fileName),
        fileUrl,
        mimeType: mimeType.slice(0, 100),
        size: buffer.length,
        hash,
        uploaderId: uploaderId === null ? null : BigInt(uploaderId),
      },
    });
    return { duplicated: false, file: this.toFileItem(record) };
  }

  /** 分页查询文件列表。 */
  async list(query: {
    skip: number;
    take: number;
    originName?: string;
    mimeType?: string;
    uploaderId?: number;
  }): Promise<{ list: FileItem[]; total: number }> {
    const where = {
      ...(query.originName ? { originName: { contains: query.originName } } : {}),
      ...(query.mimeType ? { mimeType: { contains: query.mimeType } } : {}),
      ...(query.uploaderId !== undefined ? { uploaderId: BigInt(query.uploaderId) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.file.findMany({ where, orderBy: { id: 'desc' }, skip: query.skip, take: query.take }),
      this.prisma.file.count({ where }),
    ]);
    return { list: rows.map((row) => this.toFileItem(row)), total };
  }

  /** 按 id 删除文件（同时删除磁盘文件）。 */
  async remove(id: number): Promise<void> {
    const record = await this.prisma.file.findUnique({ where: { id: BigInt(id) } });
    if (!record) {
      throw AppException.notFound('文件不存在');
    }
    // 删除磁盘文件（失败不阻断：记录已删即可）
    const diskPath = path.join(config.upload.dir, record.fileName);
    await fsp.unlink(diskPath).catch(() => undefined);
    await this.prisma.file.delete({ where: { id: BigInt(id) } });
  }

  /** 数据库记录 → 对外 DTO。 */
  private toFileItem(row: {
    id: bigint;
    originName: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    size: number;
    hash: string | null;
    uploaderId: bigint | null;
    createdAt: Date;
  }): FileItem {
    return {
      id: Number(row.id),
      originName: row.originName,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType,
      size: row.size,
      hash: row.hash,
      uploaderId: row.uploaderId === null ? null : Number(row.uploaderId),
      createdAt: row.createdAt,
    };
  }
}
