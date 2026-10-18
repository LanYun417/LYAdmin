/**
 * 上传文件的磁盘布局与路径安全解析。
 * 模块职责：把「按扩展名分组存储」这条规则收敛到一处，供 multer 落盘、文件服务入库、
 * 缩略图读取共用——三处各写一套路径规则迟早会漂移。
 *
 * 布局：`<UPLOAD_DIR>/<ext>/<timestamp>-<random><ext>`
 * - 目录名 = 小写扩展名去掉点（如 `png` / `pdf`）；只允许字母数字，异常值归入 `other`；
 * - DB 的 `fileName` 存**相对路径**（posix 分隔符），`filePath` 存 `<dirName>/<相对路径>`，
 *   这样单条记录自带分组信息，历史平铺文件（`fileName` 无目录）仍可被同一套逻辑读取；
 * - 所有读盘入口一律经 `resolveStoredPath` 解析，越界（`..`、绝对路径）返回 null。
 */
import path from 'node:path';
import { config } from '../config/config.js';

/** 无法识别扩展名时的兜底分组目录。 */
const FALLBACK_FOLDER = 'other';

/**
 * 扩展名 → 分组目录名（`'.PNG'` → `'png'`，异常值 → `'other'`）。
 * @param ext 带点的扩展名（可来自 `path.extname`）
 */
export function extensionFolder(ext: string): string {
  const normalized = ext.replace(/^\./, '').toLowerCase();
  return /^[a-z0-9]+$/.test(normalized) ? normalized : FALLBACK_FOLDER;
}

/**
 * 生成存储相对路径（posix 分隔符，始终以分组目录开头）。
 * @param ext 带点的扩展名
 * @param fileName 文件名（不含目录）
 */
export function storageRelativePath(ext: string, fileName: string): string {
  return `${extensionFolder(ext)}/${fileName}`;
}

/**
 * 把相对路径解析为磁盘绝对路径，并确保仍在 UPLOAD_DIR 之内。
 * @param relativePath DB 中的相对路径（posix / 本地分隔符均可）
 * @returns 绝对路径；越界或为绝对路径时返回 null
 */
export function resolveStoredPath(relativePath: string): string | null {
  const root = config.upload.dir;
  const absolute = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(prefix)) {
    return null;
  }
  return absolute;
}

/** 统一的 posix 化（Windows 下 path.join 产出反斜杠，入库/拼 URL 前必须转换）。 */
export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}
