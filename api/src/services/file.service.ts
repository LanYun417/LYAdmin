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

/** 幻数校验读取的头部字节数（覆盖到 WEBP 的偏移 8~11 即可）。 */
const MAGIC_HEAD_BYTES = 16;

/** 判断缓冲区是否以指定字节序列开头。 */
function startsWithBytes(head: Buffer, bytes: number[]): boolean {
  if (head.length < bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => head[index] === byte);
}

/**
 * 扩展名 → 幻数匹配函数。
 *
 * 说明（重要）：
 * - 白名单 `UPLOAD_ALLOWED_EXT` 中 `.txt` 无稳定魔数（可为 BOM/纯 ASCII 等任意文本），
 *   故**有意不在本表登记**，校验时跳过（宁可放行文本，也不误杀）。
 * - `.docx` / `.xlsx` 本质是 ZIP 容器，`.zip` 同理，均以 `PK\x03\x04` 开头（另有空归档 `PK\x05\x06`、
 *   分卷 `PK\x07\x08` 两种合法头）；`.doc` 为 OLE 复合文档。
 * - `.avif` 不在 `UPLOAD_ALLOWED_EXT` 白名单内，上传本就不放行，此处无需登记。
 */
const MAGIC_BY_EXT: Record<string, (head: Buffer) => boolean> = {
  '.png': (head) => startsWithBytes(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  '.jpg': (head) => startsWithBytes(head, [0xff, 0xd8, 0xff]),
  '.jpeg': (head) => startsWithBytes(head, [0xff, 0xd8, 0xff]),
  '.gif': (head) => startsWithBytes(head, [0x47, 0x49, 0x46, 0x38]),
  '.bmp': (head) => startsWithBytes(head, [0x42, 0x4d]),
  '.pdf': (head) => startsWithBytes(head, [0x25, 0x50, 0x44, 0x46]),
  // WEBP：RIFF....WEBP（RIFF + 4 字节长度 + WEBP）
  '.webp': (head) =>
    startsWithBytes(head, [0x52, 0x49, 0x46, 0x46]) &&
    head.length >= 12 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50,
  // ZIP 容器族：zip / docx / xlsx 均以 PK 开头
  '.zip': (head) =>
    startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(head, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(head, [0x50, 0x4b, 0x07, 0x08]),
  '.docx': (head) => startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]),
  '.xlsx': (head) => startsWithBytes(head, [0x50, 0x4b, 0x03, 0x04]),
  // OLE 复合文档（旧版 .doc）
  '.doc': (head) => startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  // OLE 复合文档（旧版 .xls，遗留 BIFF 格式），与 .doc 复用同一 OLE 判定
  '.xls': (head) => startsWithBytes(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
};

/**
 * 读取文件前 `length` 字节（不整文件载入内存）。
 * @param absolutePath 物理文件绝对路径
 * @param length 读取字节数
 */
async function readHead(absolutePath: string, length: number): Promise<Buffer> {
  const handle = await fs.promises.open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * 校验已落盘文件的「幻数」（文件头魔数）是否与其扩展名匹配。
 *
 * 背景：multer 的 `fileFilter` 阶段拿不到文件内容 buffer（diskStorage 落盘后才可读），
 * 且客户端提交的 `mimetype`/`originalname` 可被伪造；因此**必须在文件落盘之后**基于真实
 * 内容做校验。白名单内未登记魔数的类型（如 `.txt`）跳过校验，避免误杀。
 * @param absolutePath 已落盘文件绝对路径
 * @param ext 文件扩展名（含点，大小写不敏感）
 * @throws AppError 400 内容与扩展名不匹配
 */
export async function assertFileMagic(absolutePath: string, ext: string): Promise<void> {
  const normalizedExt = ext.toLowerCase();
  const checker = MAGIC_BY_EXT[normalizedExt];
  if (!checker) {
    return;
  }
  const head = await readHead(absolutePath, MAGIC_HEAD_BYTES);
  if (!checker(head)) {
    throw AppError.badRequest(`文件内容与扩展名不匹配: ${normalizedExt}（疑似伪造类型）`);
  }
}

/** multer 文件 → 物理绝对路径。 */
function toAbsolutePath(file: Express.Multer.File): string {
  return path.isAbsolute(file.path) ? file.path : path.resolve(config.rootDir, file.path);
}

/**
 * 校验本批已落盘文件的魔数；任一不匹配则删除**本批全部**已落盘文件后抛出 400。
 *
 * 安全约束：只清理本次请求新产生的文件（`files` 参数内的），绝不触碰历史/其它请求的文件。
 * @param files 本批 multer 文件数组
 * @throws AppError 400 任一文件内容与扩展名不匹配
 */
async function assertFilesMagic(files: Express.Multer.File[]): Promise<void> {
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    try {
      await assertFileMagic(toAbsolutePath(file), ext);
    } catch (error) {
      // 校验失败：清理本批已落盘的全部文件，避免磁盘残留
      for (const item of files) {
        try {
          fs.rmSync(toAbsolutePath(item), { force: true });
        } catch (removeError) {
          console.error('[FileService] 清理非法上传文件失败:', removeError);
        }
      }
      throw error;
    }
  }
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
  // 幻数校验：diskStorage 落盘后才有文件内容，故在此对每个已落盘文件做真实内容校验；
  // 任一不匹配 → 清理本批全部文件并抛 400（防止伪造后缀/类型绕过白名单，且不留磁盘残留）。
  await assertFilesMagic(files);

  const items: FileItem[] = [];

  for (const file of files) {
    const originName = decodeOriginalName(file.originalname);
    const absolutePath = path.isAbsolute(file.path) ? file.path : path.resolve(config.rootDir, file.path);
    const hash = await computeSha256(absolutePath);

    // 内容去重：同哈希文件已存在 → 秒传语义（库里已有，不新增任何记录）。
    // 清理本次上传的物理文件，直接返回既有记录并标记 deduplicated。
    const existing = await File.findOne({ where: { hash }, order: [['id', 'ASC']] });

    if (existing) {
      try {
        fs.rmSync(absolutePath, { force: true });
      } catch (error) {
        console.error('[FileService] 清理重复上传的物理文件失败:', error);
      }

      items.push({ ...toFileItem(existing), deduplicated: true });
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

/** 可下载文件信息（供控制器流式响应）。 */
export interface FileDownload {
  /** 物理文件绝对路径 */
  absolutePath: string;
  /** 原始文件名（用于 Content-Disposition） */
  originName: string;
  mimeType: string;
  size: number;
}

/**
 * 按 id 取得可下载文件信息（不把文件内容读入内存，交由控制器流式响应）。
 * @param id 文件 id
 * @throws AppError 404 记录不存在或磁盘文件已丢失
 */
export async function getFileForDownload(id: number): Promise<FileDownload> {
  const record = await File.findByPk(id);
  if (!record) {
    throw AppError.notFound('文件不存在');
  }

  const absolutePath = resolvePhysicalPath(record.filePath);
  if (!fs.existsSync(absolutePath)) {
    throw AppError.notFound('文件已丢失');
  }

  return {
    absolutePath,
    originName: record.originName,
    mimeType: record.mimeType,
    size: Number(record.size),
  };
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
