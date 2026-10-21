/**
 * 防盗链与图片缩放中间件。
 * 模块职责：
 * - `HotlinkGuard`：拦截外站盗链请求（Referer 白名单）
 * - `ImageScaleService`：按 `?scale=` 参数生成缩略图并缓存
 *
 * ⚠️ 缩略图缓存的**周期清理**已收编到 TaskModule 的「缩略图缓存清理」任务，
 * 本服务只保留 sweep() 这个「怎么做」，不再自带 setInterval 定时器。
 */
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config/config.js';
import { AppException } from '../exception/app.exception.js';
import { resolveStoredPath } from './storage-layout.js';

/**
 * 防盗链守卫：外站请求直接 403，连文件都不必读。
 * 放行规则：无 Referer、同源（与请求 host 一致）、命中白名单之一。
 */
@Injectable()
export class HotlinkGuardMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const referer = req.headers.referer;
    // 无 Referer：放行（直接访问 / 收藏夹 / 服务端调用）
    if (!referer) {
      next();
      return;
    }

    let host: string;
    try {
      host = new URL(referer).host.toLowerCase();
    } catch {
      // Referer 格式非法：视为外链
      res.status(403).json({ code: 403, message: '外链访问被拒绝', data: null });
      return;
    }

    // 同源放行
    const reqHost = (req.headers.host ?? '').toLowerCase();
    if (host === reqHost) {
      next();
      return;
    }

    // 命中白名单放行
    if (config.upload.allowedReferers.includes(host)) {
      next();
      return;
    }

    res.status(403).json({ code: 403, message: '外链访问被拒绝', data: null });
  }
}

@Injectable()
export class ImageScaleService {
  private readonly logger = new Logger(ImageScaleService.name);

  constructor() {
    if (!existsSync(config.upload.cacheDir)) {
      mkdirSync(config.upload.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缩略图并返回文件 Buffer。
   *
   * 缓存布局：`<UPLOAD_CACHE_DIR>/<hash(相对路径)>/<宽度>.jpg`。
   * 用「一级子目录 + 宽度文件名」而不是平铺的 `hash(路径+宽度).jpg`，
   * 是为了让「原文件被删除」时能按目录整体清理（否则宽度组合未知，只能靠 TTL 兜底）。
   *
   * @param relativePath 上传目录内的相对路径（形如 `png/173xxx_ab12cd34.png`）
   * @param width 目标宽度（高度按比例）
   * @returns 缩放后的图片 Buffer；失败抛 AppException
   */
  async scale(relativePath: string, width: number): Promise<Buffer> {
    // 统一经安全解析：越界（`..`、绝对路径）直接判为非法，而非拼出目录外的路径
    const srcPath = resolveStoredPath(relativePath);
    if (srcPath === null) {
      throw AppException.badRequest('非法的文件名');
    }
    if (!existsSync(srcPath)) {
      throw AppException.notFound('文件不存在');
    }

    const cachePath = this.cachePathOf(relativePath, width);

    // 命中缓存直接返回
    if (existsSync(cachePath)) {
      return fsp.readFile(cachePath);
    }

    try {
      const buffer = await sharp(srcPath).resize({ width }).jpeg({ quality: 85 }).toBuffer();
      await fsp.mkdir(path.dirname(cachePath), { recursive: true }).catch(() => undefined);
      await fsp.writeFile(cachePath, buffer).catch(() => undefined);
      return buffer;
    } catch (error) {
      throw AppException.badRequest(`图片缩放失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理某个上传文件的全部缩略图缓存（删除原文件时调用）。
   * @param relativePath 上传目录内的相对路径
   */
  async clearFor(relativePath: string): Promise<void> {
    const dir = path.join(config.upload.cacheDir, this.cacheKeyOf(relativePath));
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  /**
   * 缓存清理：先按 TTL 删除过期条目，再按体积上限淘汰最久未访问的条目。
   *
   * 由 TaskModule 的「缩略图缓存清理」任务按 cron 调用，不自带定时器。
   * @returns 删除的文件数与释放的字节数（供日志与测试断言）
   */
  async sweep(): Promise<{ removed: number; freedBytes: number }> {
    const root = config.upload.cacheDir;
    if (!existsSync(root)) {
      return { removed: 0, freedBytes: 0 };
    }

    const entries: Array<{ file: string; size: number; mtimeMs: number }> = [];
    for (const dirName of await fsp.readdir(root)) {
      const dirPath = path.join(root, dirName);
      let files: string[];
      try {
        files = await fsp.readdir(dirPath);
      } catch {
        // 不是目录（历史平铺布局的残留文件）：按无归属文件处理，交给 TTL 清理
        continue;
      }
      for (const fileName of files) {
        const filePath = path.join(dirPath, fileName);
        try {
          const stat = await fsp.stat(filePath);
          if (stat.isFile()) {
            entries.push({ file: filePath, size: stat.size, mtimeMs: stat.mtimeMs });
          }
        } catch {
          // 并发删除等竞态：忽略
        }
      }
    }

    const ttlMs = Math.max(config.upload.cacheTtlDays, 0) * 24 * 60 * 60 * 1000;
    const maxBytes = Math.max(config.upload.cacheMaxMb, 0) * 1024 * 1024;
    const now = Date.now();
    const doomed = new Set<string>();

    if (ttlMs > 0) {
      entries.filter((entry) => now - entry.mtimeMs > ttlMs).forEach((entry) => doomed.add(entry.file));
    }

    if (maxBytes > 0) {
      let liveBytes = entries.filter((entry) => !doomed.has(entry.file)).reduce((sum, e) => sum + e.size, 0);
      if (liveBytes > maxBytes) {
        // 最久未访问（mtime 最早）优先淘汰
        const candidates = entries
          .filter((entry) => !doomed.has(entry.file))
          .sort((left, right) => left.mtimeMs - right.mtimeMs);
        for (const entry of candidates) {
          if (liveBytes <= maxBytes) {
            break;
          }
          doomed.add(entry.file);
          liveBytes -= entry.size;
        }
      }
    }

    let removed = 0;
    let freedBytes = 0;
    for (const entry of entries) {
      if (!doomed.has(entry.file)) {
        continue;
      }
      const ok = await fsp
        .unlink(entry.file)
        .then(() => true)
        .catch(() => false);
      if (ok) {
        removed += 1;
        freedBytes += entry.size;
      }
    }

    // 顺手清掉空目录（只处理缓存根下的一级目录，空目录无意义）
    for (const dirName of await fsp.readdir(root).catch(() => [] as string[])) {
      const dirPath = path.join(root, dirName);
      await fsp.rmdir(dirPath).catch(() => undefined);
    }

    if (removed > 0) {
      this.logger.log(
        `[ImageCache] 清理完成：删除 ${removed} 个缓存文件，释放 ${(freedBytes / 1024 / 1024).toFixed(2)}MB`,
      );
    }
    return { removed, freedBytes };
  }

  /** 缓存键：相对路径的 SHA-256（同一原文件的各宽度共用一级目录）。 */
  private cacheKeyOf(relativePath: string): string {
    return createHash('sha256').update(relativePath).digest('hex');
  }

  /** 缓存文件绝对路径：`<cacheDir>/<hash>/<width>.jpg`。 */
  private cachePathOf(relativePath: string, width: number): string {
    return path.join(config.upload.cacheDir, this.cacheKeyOf(relativePath), `${width}.jpg`);
  }
}

/**
 * 图片缩放中间件：命中合法 `?scale=` 且为图片时输出缩放结果，
 * 否则 next() 交由静态服务出原图。
 */
@Injectable()
export class ImageScaleMiddleware implements NestMiddleware {
  constructor(private readonly imageScaleService: ImageScaleService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawScale = (req.query as Record<string, unknown> | undefined)?.scale;
    if (rawScale === undefined || rawScale === '') {
      next();
      return;
    }

    const width = Number(rawScale);
    if (!Number.isFinite(width) || width <= 0 || width > 2000) {
      next();
      return;
    }

    // 去掉静态路由前缀，得到「扩展名分组/文件名」的相对路径（分组后不能再取 basename）
    const prefix = `/${config.upload.route}/`;
    const decodedPath = decodeURIComponent(req.path);
    const relativePath = decodedPath.startsWith(prefix)
      ? decodedPath.slice(prefix.length)
      : decodedPath.replace(/^\/+/, '');

    // 仅处理常见图片扩展名
    if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(relativePath)) {
      next();
      return;
    }

    try {
      const buffer = await this.imageScaleService.scale(relativePath, Math.floor(width));
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buffer);
    } catch {
      // 缩放失败不阻断：回退到原图
      next();
    }
  }
}
