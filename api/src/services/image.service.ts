/**
 * 图片按需缩放服务。
 * 模块职责：
 *  1. 判定文件是否为可缩放图片（扩展名白名单）；
 *  2. 解析 `?scale=` 等比缩放比例（尺寸维度，非画质质量）；
 *  3. 依据比例生成/复用磁盘缓存，返回可直接 sendFile 的绝对路径。
 * 设计要点：磁盘缓存 + 保持原格式 + 只缩不放 + 并发去重 + 任何异常回退原图。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { config } from '@/config';

/** 允许参与缩放的图片扩展名白名单（小写、含点）。 */
const IMAGE_EXT_WHITELIST = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

/** scale 允许的最小值（含）。 */
const MIN_SCALE = 0.1;

/** scale 允许的最大值（含）；等于该值表示原图，不做处理。 */
const MAX_SCALE = 1;

/** 扩展名 → MIME 类型映射（用于设置响应头）。 */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/**
 * 同缓存键并发去重映射：key = 缓存文件绝对路径，value = 该次压缩的 Promise。
 * 同一键的并发请求共享同一个 Promise，保证只压缩一次。
 */
const inflight = new Map<string, Promise<string>>();

/**
 * 按扩展名判断是否为可缩放图片。
 * @param name 文件名或路径
 * @returns 命中白名单返回 true
 */
export function isImageFile(name: string): boolean {
  return IMAGE_EXT_WHITELIST.has(path.extname(name).toLowerCase());
}

/**
 * 依据扩展名获取图片 MIME 类型。
 * @param name 文件名或路径
 * @returns 已知图片返回对应 MIME，否则回退 application/octet-stream
 */
export function getImageMimeType(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * 解析 `?scale=` 查询参数。
 * 归一化到 2 位小数，合法范围 [0.1, 1]。
 * @param raw 原始查询值（可能是 string | string[] | undefined）
 * @returns 合法时返回归一化后的比例；缺省/非法（非数字、空串、0、负数、>1、NaN）返回 null（按原图处理）
 */
export function parseScale(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const text = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  // Number.isFinite 同时排除 NaN / Infinity / -Infinity
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < MIN_SCALE || value > MAX_SCALE) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

/** 依据原文件路径与比例，计算缓存文件的绝对路径。 */
function buildCachePath(sourceAbsPath: string, scale: number): string {
  const ext = path.extname(sourceAbsPath).toLowerCase();
  const base = path.basename(sourceAbsPath, path.extname(sourceAbsPath));
  const cacheFileName = `${base}_s${scale.toFixed(2)}${ext}`;
  return path.join(config.upload.cacheDir, cacheFileName);
}

/**
 * 获取指定图片在指定比例下的（缩放后）绝对路径。
 * 命中缓存直接返回；否则用 sharp 等比缩放并落盘到缓存目录。
 * 不指定输出格式 → 保持原格式；只缩不放；任何异常均内部捕获并回退原图路径。
 * @param sourceAbsPath 原图绝对路径
 * @param scale 归一化后的缩放比例（[0.1, 1]）
 * @returns 可直接 sendFile 的绝对路径（缩放缓存或原图）
 */
export async function getScaledImage(sourceAbsPath: string, scale: number): Promise<string> {
  try {
    // scale = 1（或以上）等价于原图，不做任何处理
    if (scale >= MAX_SCALE) {
      return sourceAbsPath;
    }

    const cachePath = buildCachePath(sourceAbsPath, scale);

    // 缓存命中：文件已存在直接复用，不重复压缩
    if (fs.existsSync(cachePath)) {
      return cachePath;
    }

    // 并发去重：同一缓存键已在压缩中，复用其 Promise
    const existing = inflight.get(cachePath);
    if (existing) {
      return await existing;
    }

    const task = (async (): Promise<string> => {
      const metadata = await sharp(sourceAbsPath).metadata();
      const width = metadata.width ?? 0;
      if (width <= 0) {
        return sourceAbsPath;
      }

      const targetWidth = Math.round(width * scale);
      // 只缩不放：目标宽 >= 原宽（含四舍五入后等于），或目标宽非法 → 原图
      if (targetWidth >= width || targetWidth < 1) {
        return sourceAbsPath;
      }

      await fs.promises.mkdir(config.upload.cacheDir, { recursive: true });
      // 不指定格式 → 保持原格式；仅按宽度等比缩放（高度自动按比例）
      await sharp(sourceAbsPath).resize({ width: targetWidth }).toFile(cachePath);
      return cachePath;
    })();

    inflight.set(cachePath, task);
    try {
      return await task;
    } finally {
      inflight.delete(cachePath);
    }
  } catch (error) {
    console.error('[ImageService] 图片缩放失败，回退原图:', sourceAbsPath, error);
    return sourceAbsPath;
  }
}
