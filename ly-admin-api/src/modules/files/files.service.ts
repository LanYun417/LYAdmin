/**
 * 文件服务。
 * 模块职责：上传（含幻数校验/哈希秒传预检）、列表、类型/上传人选项、下载、删除。
 */
import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { AppException } from '../../common/exception/app.exception.js';
import { config } from '../../common/config/config.js';
import { UPLOAD_ALLOWED_EXT, UPLOAD_ALLOWED_MIME } from '../../common/config/constants.js';
import { sha256 } from '../../common/utils/utils.js';
import { resolveStoredPath, storageRelativePath, toPosixPath } from '../../common/file/storage-layout.js';
import { ImageScaleService } from '../../common/file/file-guards.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 文件列表项（对外返回，含前端契约字段）。 */
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

/** 上传返回的精简结果（前端上传接口返回 FileItem[]）。 */
export type UploadResult = FileItem[];

/** 上传人选项（id + 账号 + 昵称）。 */
export interface FileUploaderOption {
  id: number;
  username: string;
  nickname: string;
}

/** 可下载文件信息。 */
export interface FileDownload {
  absolutePath: string;
  originName: string;
  mimeType: string;
  size: number;
}

/** 幻数校验读取的头部字节数（覆盖到 WEBP 偏移 8~11 即可）。 */
const MAGIC_HEAD_BYTES = 16;

/** 判断缓冲区是否以指定字节序列开头。 */
function startsWithBytes(head: Buffer, bytes: number[]): boolean {
  if (head.length < bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => head[index] === byte);
}

/**
 * 扩展名 → 幻数匹配函数（`.txt` 无稳定魔数故有意不登记，`.zip/.docx/.xlsx`
 * 均为 PK 容器族；`.doc/.xls` 为 OLE 复合文档）。
 */
const MAGIC_BY_EXT: Record<string, (head: Buffer) => boolean> = {
  '.png': (head) => startsWithBytes(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  '.jpg': (head) => startsWithBytes(head, [0xff, 0xd8, 0xff]),
  '.jpeg': (head) => startsWithBytes(head, [0xff, 0xd8, 0xff]),
  '.gif': (head) => startsWithBytes(head, [0x47, 0x49, 0x46, 0x38]),
  '.bmp': (head) => startsWithBytes(head, [0x42, 0x4d]),
  '.pdf': (head) => startsWithBytes(head, [0x25, 0x50, 0x44, 0x46]),
  '.webp': (head) =>
    startsWithBytes(head, [0x52, 0x49, 0x46, 0x46]) &&
    head.length >= 12 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50,
  '.zip': (head) =>
    startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(head, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(head, [0x50, 0x4b, 0x07, 0x08]),
  '.docx': (head) => startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]),
  '.xlsx': (head) => startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]),
  '.doc': (head) => startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  '.xls': (head) => startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
};

/** 读取文件前 `length` 字节（不整文件载入内存）。 */
async function readHead(absolutePath: string, length: number): Promise<Buffer> {
  const handle = await fsp.open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * 校验已落盘文件的「幻数」是否与其扩展名匹配（白名单内未登记魔数的类型跳过）。
 * @throws AppException 400 内容与扩展名不匹配
 */
async function assertFileMagic(absolutePath: string, ext: string): Promise<void> {
  const checker = MAGIC_BY_EXT[ext.toLowerCase()];
  if (!checker) {
    return;
  }
  const head = await readHead(absolutePath, MAGIC_HEAD_BYTES);
  if (!checker(head)) {
    throw AppException.badRequest(`文件内容与扩展名不匹配: ${ext}（疑似伪造类型）`);
  }
}

/**
 * 修正 multipart 文件名编码。
 *
 * busboy 默认按 latin1 解析 `filename=`，中文文件名会变成「ä¸‹è½½」式乱码并原样入库。
 * 若按 UTF-8 重新解码能得到合法字符串（不含替换符），就采用解码结果；纯 ASCII 不受影响。
 */
function decodeMultipartName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** 入参数值归一（空值/非法值返回 undefined，表示该条件不参与过滤）。 */
function toFilterNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** 入参时间归一（ISO 8601；非法返回 undefined）。 */
function toFilterDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageScaleService: ImageScaleService,
  ) {
    if (!existsSync(config.upload.dir)) {
      mkdirSync(config.upload.dir, { recursive: true });
    }
  }

  /** 数据库记录 → 对外 DTO（含前端需要的 filePath / createdAt）。 */
  private toFileItem(row: {
    id: bigint;
    originName: string;
    fileName: string;
    filePath: string;
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
      filePath: row.filePath,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType,
      size: Number(row.size),
      hash: row.hash,
      uploaderId: row.uploaderId === null ? null : Number(row.uploaderId),
      createdAt: row.createdAt,
    };
  }

  /**
   * 校验上传文件的类型白名单，返回小写扩展名。
   * @throws AppException 400 不支持的类型
   */
  private validateUpload(originalName: string, mimeType: string): string {
    const ext = path.extname(originalName).toLowerCase();
    if (!UPLOAD_ALLOWED_EXT.includes(ext)) {
      throw AppException.badRequest(`不支持的文件类型: ${ext || '未知'}`);
    }
    if (!UPLOAD_ALLOWED_MIME.includes(mimeType)) {
      throw AppException.badRequest(`不支持的文件 MIME 类型: ${mimeType}`);
    }
    return ext;
  }

  /**
   * 校验一个已落盘（diskStorage）的 multer 文件：类型白名单 + 幻数校验。
   * 校验失败清理本文件并向上抛出，避免磁盘残留。
   * @returns 相对存储路径（`<扩展名分组>/<文件名>`）、扩展名与绝对路径
   */
  private async persist(
    file: Express.Multer.File,
    originalName: string,
  ): Promise<{ relPath: string; ext: string; absPath: string }> {
    const ext = this.validateUpload(originalName, file.mimetype);
    const absPath = file.path; // diskStorage 已落盘到 config.upload.dir/<扩展名分组>/
    try {
      await assertFileMagic(absPath, ext);
    } catch (error) {
      await fsp.unlink(absPath).catch(() => undefined);
      throw error;
    }
    const relPath = storageRelativePath(ext, path.basename(absPath));
    return { relPath, ext, absPath };
  }

  /**
   * 保存上传文件（多文件）。先逐文件落盘 + 幻数校验，再按内容哈希秒传去重。
   * 任一文件内容与扩展名不匹配 → 清理本批全部已落盘文件并抛 400。
   */
  async saveFiles(files: Express.Multer.File[], uploaderId: number | null): Promise<FileItem[]> {
    if (!files || files.length === 0) {
      throw AppException.badRequest('未接收到文件');
    }

    // 第一阶段：逐文件落盘并幻数校验（失败即清理本批）
    const prepared: Array<{
      relPath: string;
      ext: string;
      absPath: string;
      originName: string;
      mimeType: string;
      size: number;
    }> = [];
    try {
      for (const file of files) {
        // multipart 的 filename 默认按 latin1 解析，中文名需按 UTF-8 回正后再入库
        const originalName = decodeMultipartName(file.originalname);
        const { relPath, ext, absPath } = await this.persist(file, originalName);
        prepared.push({
          relPath,
          ext,
          absPath,
          originName: originalName,
          mimeType: file.mimetype,
          size: file.size,
        });
      }
    } catch (error) {
      for (const item of prepared) {
        await fsp.unlink(item.absPath).catch(() => undefined);
      }
      throw error;
    }

    // 第二阶段：内容哈希 → 秒传去重
    const items: FileItem[] = [];
    for (const item of prepared) {
      const buffer = await fsp.readFile(item.absPath);
      const hash = sha256(buffer);
      const existing = await this.prisma.file.findFirst({ where: { hash }, orderBy: { id: 'asc' } });
      if (existing) {
        // 命中秒传：删除本次落盘的物理文件，复用既有记录
        await fsp.unlink(item.absPath).catch(() => undefined);
        items.push({ ...this.toFileItem(existing), deduplicated: true });
        continue;
      }
      const fileUrl = `/${config.upload.route}/${item.relPath}`;
      const record = await this.prisma.file.create({
        data: {
          originName: item.originName.slice(0, 255),
          // fileName 存相对路径（含扩展名分组），单条记录自带定位信息
          fileName: item.relPath,
          filePath: toPosixPath(path.join(config.upload.dirName, item.relPath)),
          fileUrl,
          mimeType: item.mimeType.slice(0, 100),
          size: item.size,
          hash,
          uploaderId: uploaderId === null ? null : BigInt(uploaderId),
        },
      });
      items.push(this.toFileItem(record));
    }
    return items;
  }

  /** 按内容哈希查询已存在的文件（秒传预检）。入参统一转小写后再匹配。 */
  async checkFileByHash(hash: string): Promise<FileItem | null> {
    const normalized = hash.toLowerCase();
    const record = await this.prisma.file.findFirst({ where: { hash: normalized }, orderBy: { id: 'asc' } });
    return record ? this.toFileItem(record) : null;
  }

  /** 分页查询文件列表（多条件 AND）。 */
  async listFiles(query: Record<string, unknown>): Promise<{
    list: FileItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = toFilterNumber(query.page) ?? 1;
    const pageSizeRaw = toFilterNumber(query.pageSize);
    const pageSize = pageSizeRaw && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 100) : 10;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    const originName = typeof query.originName === 'string' ? query.originName.trim() : '';
    if (originName) {
      where.originName = { contains: originName };
    }
    const mimeType = typeof query.mimeType === 'string' ? query.mimeType.trim() : '';
    if (mimeType) {
      where.mimeType = mimeType;
    }
    const uploaderId = toFilterNumber(query.uploaderId);
    if (uploaderId !== undefined && uploaderId > 0) {
      where.uploaderId = BigInt(uploaderId);
    }
    const startTime = toFilterDate(query.startTime);
    const endTime = toFilterDate(query.endTime);
    if (startTime || endTime) {
      const range: Record<string, Date> = {};
      if (startTime) range.gte = startTime;
      if (endTime) range.lte = endTime;
      where.createdAt = range;
    }
    const minSize = toFilterNumber(query.minSize);
    const maxSize = toFilterNumber(query.maxSize);
    if (minSize !== undefined || maxSize !== undefined) {
      const range: Record<string, number> = {};
      if (minSize !== undefined) range.gte = minSize;
      if (maxSize !== undefined) range.lte = maxSize;
      where.size = range;
    }

    const [rows, total] = await Promise.all([
      this.prisma.file.findMany({ where, orderBy: { id: 'desc' }, skip, take: pageSize }),
      this.prisma.file.count({ where }),
    ]);
    return { list: rows.map((row) => this.toFileItem(row)), total, page, pageSize };
  }

  /** 文件类型（MIME）选项：对库内已有文件去重，无硬编码枚举。 */
  async listFileTypes(): Promise<string[]> {
    const rows = await this.prisma.file.findMany({
      select: { mimeType: true },
      distinct: ['mimeType'],
      orderBy: { mimeType: 'asc' },
    });
    return rows.map((row) => String(row.mimeType ?? '')).filter(Boolean);
  }

  /** 上传人选项：对库内 uploader_id 去重后关联用户表取展示名。 */
  async listFileUploaders(): Promise<FileUploaderOption[]> {
    const rows = await this.prisma.file.findMany({
      where: { uploaderId: { not: null } },
      select: { uploaderId: true },
      distinct: ['uploaderId'],
    });
    const ids = rows
      .map((row) => (row.uploaderId === null ? null : Number(row.uploaderId)))
      .filter((id): id is number => id !== null && Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, username: true, nickname: true },
      orderBy: { id: 'asc' },
    });
    return users.map((user) => ({
      id: Number(user.id),
      username: user.username,
      nickname: user.nickname,
    }));
  }

  /** 按 id 取得可下载文件信息（不读入内存，交由控制器流式响应）。 */
  async getFileForDownload(id: number): Promise<FileDownload> {
    const record = await this.prisma.file.findUnique({ where: { id: BigInt(id) } });
    if (!record) {
      throw AppException.notFound('文件不存在');
    }
    // fileName 为相对路径（新数据含扩展名分组，历史数据为平铺文件名），统一经安全解析
    const absolutePath = resolveStoredPath(record.fileName);
    if (absolutePath === null || !existsSync(absolutePath)) {
      throw AppException.notFound('文件已丢失');
    }
    return {
      absolutePath,
      originName: record.originName,
      mimeType: record.mimeType,
      size: Number(record.size),
    };
  }

  /** 删除文件（引用计数语义：仅最后一条引用才删磁盘文件）。 */
  async deleteFile(id: number): Promise<void> {
    const record = await this.prisma.file.findUnique({ where: { id: BigInt(id) } });
    if (!record) {
      throw AppException.notFound('文件不存在');
    }
    const sameRefCount = await this.prisma.file.count({ where: { filePath: record.filePath } });
    await this.prisma.file.delete({ where: { id: BigInt(id) } });
    if (sameRefCount > 1) {
      return;
    }
    const absolutePath = resolveStoredPath(record.fileName);
    if (absolutePath !== null && existsSync(absolutePath)) {
      await fsp.unlink(absolutePath).catch(() => undefined);
      // 原文件真的删掉了 → 顺手清掉它的缩略图缓存（否则缓存会随删除操作只增不减）
      await this.imageScaleService.clearFor(record.fileName);
    }
  }
}
