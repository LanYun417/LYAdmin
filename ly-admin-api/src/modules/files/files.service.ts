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
  /** 业务类型（空 = 无业务归属） */
  bizType: string | null;
  /** 业务主键（空 = 未指定） */
  bizId: number | null;
  createdAt: Date;
  /** 本次保存是否复用了既有物理文件（秒传/去重），仅响应时携带 */
  deduplicated?: boolean;
}

/** 上传返回的精简结果（前端上传接口返回 FileItem[]）。 */
export type UploadResult = FileItem[];

/**
 * 上传时的业务归属入参。
 * 由调用方（业务模块）在 multipart 表单里带 `bizType` / `bizId`，便于日后按业务反查附件。
 */
export interface FileBizInput {
  /** 业务类型（模块标识，如 avatar / notice / contract） */
  bizType?: string;
  /** 业务主键 */
  bizId?: number;
}

/** 字节 → MB 文本（1 位小数，用于配额提示）。 */
function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 可选数字 → BigInt（未传视为 null，而不是 0：0 会被误读成"关联到 id=0 的业务"）。 */
function toOptionalBigInt(value: number | undefined | null): bigint | null {
  return value === undefined || value === null ? null : BigInt(value);
}

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
    bizType: string | null;
    bizId: bigint | null;
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
      bizType: row.bizType,
      bizId: row.bizId === null ? null : Number(row.bizId),
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
  async saveFiles(
    files: Express.Multer.File[],
    uploaderId: number | null,
    biz: FileBizInput = {},
  ): Promise<FileItem[]> {
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

    // 第二阶段：内容哈希 → 秒传去重（先把「秒传命中」筛掉，再对真正要落盘的做配额预检）
    const items: FileItem[] = [];
    const pending: Array<{
      relPath: string;
      absPath: string;
      originName: string;
      mimeType: string;
      size: number;
      hash: string;
      fileUrl: string;
    }> = [];

    for (const item of prepared) {
      const buffer = await fsp.readFile(item.absPath);
      const hash = sha256(buffer);
      const existing = await this.prisma.file.findFirst({ where: { hash }, orderBy: { id: 'asc' } });
      if (existing) {
        // 命中秒传：删除本次落盘的物理文件，复用既有记录
        await fsp.unlink(item.absPath).catch(() => undefined);
        // 已有业务归属时不覆盖（同一份内容可能被多个业务引用，先来先得）；
        // 既有无归属而本次带了归属 → 补写一次，避免「先上传后关联」的调用拿不到归属
        if (existing.bizType === null && biz.bizType) {
          const bound = await this.prisma.file.update({
            where: { id: existing.id },
            data: { bizType: biz.bizType, bizId: toOptionalBigInt(biz.bizId) },
          });
          items.push({ ...this.toFileItem(bound), deduplicated: true });
          continue;
        }
        items.push({ ...this.toFileItem(existing), deduplicated: true });
        continue;
      }
      pending.push({
        relPath: item.relPath,
        absPath: item.absPath,
        originName: item.originName,
        mimeType: item.mimeType,
        size: item.size,
        hash,
        fileUrl: `/${config.upload.route}/${item.relPath}`,
      });
    }

    // 配额预检：只统计真正要落盘的字节（秒传命中的不占新空间，不该因此被拒）
    const incomingBytes = pending.reduce((sum, item) => sum + item.size, 0);
    try {
      await this.assertWithinQuota(uploaderId, incomingBytes);
    } catch (error) {
      // 预检失败必须清掉本批已落盘的物理文件，否则会留下无记录可寻的孤儿文件
      for (const item of pending) {
        await fsp.unlink(item.absPath).catch(() => undefined);
      }
      throw error;
    }

    for (const item of pending) {
      const record = await this.prisma.file.create({
        data: {
          originName: item.originName.slice(0, 255),
          // fileName 存相对路径（含扩展名分组），单条记录自带定位信息
          fileName: item.relPath,
          filePath: toPosixPath(path.join(config.upload.dirName, item.relPath)),
          fileUrl: item.fileUrl,
          mimeType: item.mimeType.slice(0, 100),
          size: item.size,
          hash: item.hash,
          uploaderId: uploaderId === null ? null : BigInt(uploaderId),
          bizType: biz.bizType ?? null,
          bizId: toOptionalBigInt(biz.bizId),
        },
      });
      items.push(this.toFileItem(record));
    }
    return items;
  }

  /**
   * 查询上传配额使用情况（供 /files/quota 与上传预检共用）。
   * @param uploaderId 上传人 id（null = 匿名/无归属，按 0 计）
   */
  async getQuota(uploaderId: number | null): Promise<{ usedBytes: number; quotaBytes: number; unlimited: boolean }> {
    const quotaBytes = Math.round(config.upload.userQuotaMb * 1024 * 1024);
    return {
      usedBytes: await this.usageBytesOf(uploaderId),
      quotaBytes,
      unlimited: quotaBytes <= 0,
    };
  }

  /** 单用户已占用字节数（按 uploader_id 聚合，走 uploader_id 索引）。 */
  private async usageBytesOf(uploaderId: number | null): Promise<number> {
    if (uploaderId === null) {
      return 0;
    }
    const aggregated = await this.prisma.file.aggregate({
      _sum: { size: true },
      where: { uploaderId: BigInt(uploaderId) },
    });
    return Number(aggregated._sum.size ?? 0);
  }

  /**
   * 配额断言：`UPLOAD_USER_QUOTA_MB` 为 0 时表示不限，直接放行。
   * @param uploaderId 上传人 id
   * @param incomingBytes 本批将要落盘的字节数
   * @throws AppException 400 配额不足（消息里带上已用/本次/上限，便于用户自助处理）
   */
  private async assertWithinQuota(uploaderId: number | null, incomingBytes: number): Promise<void> {
    const quotaBytes = Math.round(config.upload.userQuotaMb * 1024 * 1024);
    if (quotaBytes <= 0) {
      return;
    }
    const usedBytes = await this.usageBytesOf(uploaderId);
    if (usedBytes + incomingBytes <= quotaBytes) {
      return;
    }
    throw AppException.badRequest(
      `上传配额不足：已用 ${formatMb(usedBytes)}，本次需 ${formatMb(incomingBytes)}，上限 ${formatMb(quotaBytes)}；请先删除不再使用的文件，或调整 UPLOAD_USER_QUOTA_MB`,
    );
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
    // 业务归属筛选：bizType 精确匹配（模块标识是枚举式取值，不做模糊），bizId 可选（>0 才参与）
    const bizType = typeof query.bizType === 'string' ? query.bizType.trim() : '';
    if (bizType) {
      where.bizType = bizType;
      const bizId = toFilterNumber(query.bizId);
      if (bizId !== undefined && bizId > 0) {
        where.bizId = BigInt(bizId);
      }
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
