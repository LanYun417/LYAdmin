/**
 * ZIP 打包工具（零第三方依赖）。
 * 模块职责：按 PKZIP 规范手工拼装 ZIP 二进制流，采用 store（不压缩）模式，
 * 供「代码生成」功能把生成的一批源码文件打包成 ZIP 返回给前端下载。
 * 说明：本项目禁止为此能力引入 archiver / jszip 等第三方库，故自行实现 CRC32 与 ZIP 三段结构。
 */

/** ZIP 条目定义。 */
export interface ZipEntry {
  /** 压缩包内的完整相对路径，用 / 分隔，例如 'backend/user.routes.ts'、'frontend/views/user/index.vue' */
  name: string;
  /** 文件内容（源码是文本，但也允许 Buffer） */
  content: string | Buffer;
}

/** 本地文件头 signature */
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
/** 中央目录头 signature */
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
/** 中央目录结束记录（EOCD）signature */
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/** 本地文件头固定长度（不含文件名与数据） */
const LOCAL_FILE_HEADER_SIZE = 30;
/** 中央目录头固定长度（不含文件名） */
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
/** 中央目录结束记录固定长度 */
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

/** 解压所需最低版本：2.0（支持目录与 deflate，store 场景取该值即可） */
const VERSION_NEEDED = 20;
/** 创建版本：高字节为操作系统（0 = MS-DOS / FAT），低字节为版本号 2.0 */
const VERSION_MADE_BY = 20;
/** 通用标志位 bit 11（0x0800）：文件名与注释为 UTF-8 编码，避免中文路径乱码 */
const GENERAL_PURPOSE_FLAG_UTF8 = 0x0800;
/** 压缩方式：0 = store（不压缩） */
const COMPRESSION_METHOD_STORE = 0;

/** 32 位无符号整数上限，非 ZIP64 格式下偏移量与长度的表示上限 */
const UINT32_MAX = 0xffffffff;
/** EOCD 中条目数字段的上限（无符号 16 位） */
const UINT16_MAX = 0xffff;

/** CRC32 查表（惰性生成，进程内只计算一次） */
let crc32Table: Uint32Array | null = null;

/**
 * 生成并返回 CRC32 查表。
 * 多项式为 IEEE 802.3 反向表示 0xEDB88320。
 * @returns 长度为 256 的 CRC32 查表
 */
function getCrc32Table(): Uint32Array {
  if (crc32Table !== null) {
    return crc32Table;
  }
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  crc32Table = table;
  return table;
}

/**
 * 计算一段数据的 CRC32（查表法）。
 * 初值 0xFFFFFFFF，结果再与 0xFFFFFFFF 异或，符合 PKZIP 规范。
 * @param data 待计算的数据
 * @returns 32 位无符号 CRC32 值
 */
function crc32(data: Buffer): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 将 Date 转换为 DOS 日期与时间字段。
 * DOS 日期：((年 - 1980) << 9) | (月 << 5) | 日；DOS 时间：(时 << 11) | (分 << 5) | (秒 / 2)。
 * @param value 日期
 * @returns DOS 时间与日期字段
 */
function toDosDateTime(value: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(value.getFullYear(), 1980);
  const dosDate = ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  const dosTime = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);
  return { dosTime: dosTime & UINT16_MAX, dosDate: dosDate & UINT16_MAX };
}

/**
 * 规范化条目名称：统一使用 / 分隔，去掉前导 /、空片段与 . 片段，并拒绝 .. 片段。
 * @param name 原始条目名称
 * @returns 规范化的相对路径
 */
function normalizeEntryName(name: string): string {
  const segments = name.replace(/\\/g, '/').split('/');
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      throw new Error(`ZIP 条目名称不允许包含 ".."：${name}`);
    }
    kept.push(segment);
  }
  const normalized = kept.join('/');
  if (normalized === '') {
    throw new Error('ZIP 条目名称不能为空');
  }
  return normalized;
}

/** 预处理后的条目：已算好 CRC32 与本地文件头偏移量，便于一次分配缓冲并顺序写入。 */
interface PreparedEntry {
  /** 文件名（UTF-8） */
  nameBuffer: Buffer;
  /** 文件内容 */
  dataBuffer: Buffer;
  /** 内容 CRC32 */
  crc: number;
  /** 本地文件头在输出缓冲中的起始偏移量 */
  localHeaderOffset: number;
}

/**
 * 写入一个条目的本地文件头与文件名。
 * store 模式下 crc32、压缩后大小、原始大小三个字段直接写真实值，无需数据描述符。
 * @param target 目标缓冲
 * @param offset 写入起始位置
 * @param entry 预处理后的条目
 * @param dosTime DOS 时间字段
 * @param dosDate DOS 日期字段
 * @returns 写入结束后的偏移量
 */
function writeLocalFileHeader(
  target: Buffer,
  offset: number,
  entry: PreparedEntry,
  dosTime: number,
  dosDate: number,
): number {
  target.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, offset);
  target.writeUInt16LE(VERSION_NEEDED, offset + 4);
  target.writeUInt16LE(GENERAL_PURPOSE_FLAG_UTF8, offset + 6);
  target.writeUInt16LE(COMPRESSION_METHOD_STORE, offset + 8);
  target.writeUInt16LE(dosTime, offset + 10);
  target.writeUInt16LE(dosDate, offset + 12);
  target.writeUInt32LE(entry.crc, offset + 14);
  target.writeUInt32LE(entry.dataBuffer.length, offset + 18);
  target.writeUInt32LE(entry.dataBuffer.length, offset + 22);
  target.writeUInt16LE(entry.nameBuffer.length, offset + 26);
  target.writeUInt16LE(0, offset + 28);
  const nameEnd = offset + LOCAL_FILE_HEADER_SIZE;
  entry.nameBuffer.copy(target, nameEnd);
  return nameEnd + entry.nameBuffer.length;
}

/**
 * 写入一个条目的中央目录头与文件名。
 * @param target 目标缓冲
 * @param offset 写入起始位置
 * @param entry 预处理后的条目
 * @param dosTime DOS 时间字段
 * @param dosDate DOS 日期字段
 * @returns 写入结束后的偏移量
 */
function writeCentralDirectoryHeader(
  target: Buffer,
  offset: number,
  entry: PreparedEntry,
  dosTime: number,
  dosDate: number,
): number {
  target.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, offset);
  target.writeUInt16LE(VERSION_MADE_BY, offset + 4);
  target.writeUInt16LE(VERSION_NEEDED, offset + 6);
  target.writeUInt16LE(GENERAL_PURPOSE_FLAG_UTF8, offset + 8);
  target.writeUInt16LE(COMPRESSION_METHOD_STORE, offset + 10);
  target.writeUInt16LE(dosTime, offset + 12);
  target.writeUInt16LE(dosDate, offset + 14);
  target.writeUInt32LE(entry.crc, offset + 16);
  target.writeUInt32LE(entry.dataBuffer.length, offset + 20);
  target.writeUInt32LE(entry.dataBuffer.length, offset + 24);
  target.writeUInt16LE(entry.nameBuffer.length, offset + 28);
  // 扩展字段长度、文件注释长度、起始磁盘号、内部文件属性均置 0
  target.writeUInt16LE(0, offset + 30);
  target.writeUInt16LE(0, offset + 32);
  target.writeUInt16LE(0, offset + 34);
  target.writeUInt16LE(0, offset + 36);
  target.writeUInt32LE(0, offset + 38);
  target.writeUInt32LE(entry.localHeaderOffset, offset + 42);
  const nameEnd = offset + CENTRAL_DIRECTORY_HEADER_SIZE;
  entry.nameBuffer.copy(target, nameEnd);
  return nameEnd + entry.nameBuffer.length;
}

/**
 * 把若干文件打包成一个 ZIP 文件的二进制内容（store 模式，不压缩）。
 * @param entries 条目数组，name 为包内相对路径，content 为文本或 Buffer
 * @returns ZIP 文件二进制内容
 */
export function createZip(entries: ZipEntry[]): Buffer {
  if (entries.length > UINT16_MAX) {
    throw new Error(`ZIP 条目数量超出非 ZIP64 格式上限（${UINT16_MAX}）：${entries.length}`);
  }

  const { dosTime, dosDate } = toDosDateTime(new Date());
  const prepared: PreparedEntry[] = [];
  let cursor = 0;
  let centralDirectorySize = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(normalizeEntryName(entry.name), 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8');
    if (dataBuffer.length > UINT32_MAX || cursor > UINT32_MAX) {
      throw new Error('ZIP 内容超出非 ZIP64 格式的 4GB 上限');
    }
    prepared.push({ nameBuffer, dataBuffer, crc: crc32(dataBuffer), localHeaderOffset: cursor });
    cursor += LOCAL_FILE_HEADER_SIZE + nameBuffer.length + dataBuffer.length;
    centralDirectorySize += CENTRAL_DIRECTORY_HEADER_SIZE + nameBuffer.length;
  }

  const centralDirectoryOffset = cursor;
  const output = Buffer.alloc(centralDirectoryOffset + centralDirectorySize + END_OF_CENTRAL_DIRECTORY_SIZE);

  let offset = 0;
  for (const entry of prepared) {
    offset = writeLocalFileHeader(output, offset, entry, dosTime, dosDate);
    offset += entry.dataBuffer.copy(output, offset);
  }

  for (const entry of prepared) {
    offset = writeCentralDirectoryHeader(output, offset, entry, dosTime, dosDate);
  }

  // EOCD：磁盘号与中央目录起始磁盘号置 0（单文件/单磁盘）；条目数写两份（本磁盘与总计，此处相等）；无注释
  output.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, offset);
  output.writeUInt16LE(0, offset + 4);
  output.writeUInt16LE(0, offset + 6);
  output.writeUInt16LE(prepared.length, offset + 8);
  output.writeUInt16LE(prepared.length, offset + 10);
  output.writeUInt32LE(centralDirectorySize, offset + 12);
  output.writeUInt32LE(centralDirectoryOffset, offset + 16);
  output.writeUInt16LE(0, offset + 20);

  return output;
}
