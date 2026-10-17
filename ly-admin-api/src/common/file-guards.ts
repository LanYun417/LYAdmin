/**
 * 防盗链与图片缩放中间件。
 * 模块职责：
 * - `HotlinkGuard`：拦截外站盗链请求（Referer 白名单）
 * - `ImageScaleService`：按 `?scale=` 参数生成缩略图并缓存
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';
import { AppException } from './app.exception.js';

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
  constructor() {
    if (!existsSync(config.upload.cacheDir)) {
      mkdirSync(config.upload.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缩略图并返回文件 Buffer。
   *
   * 缓存键：`原文件名 + 宽度` 的 SHA-256，落在 UPLOAD_CACHE_DIR
   * （必须在静态服务根目录之外，否则缓存文件会被公开访问）。
   *
   * @param fileName 原始文件名（位于上传目录内）
   * @param width 目标宽度（高度按比例）
   * @returns 缩放后的图片 Buffer；失败抛 AppException
   */
  async scale(fileName: string, width: number): Promise<Buffer> {
    const srcPath = path.join(config.upload.dir, fileName);
    if (!existsSync(srcPath)) {
      throw AppException.notFound('文件不存在');
    }

    // 防止路径穿越（文件名不应包含目录分隔符）
    if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
      throw AppException.badRequest('非法的文件名');
    }

    const cacheName = `${createHash('sha256').update(`${fileName}:${width}`).digest('hex')}.jpg`;
    const cachePath = path.join(config.upload.cacheDir, cacheName);

    // 命中缓存直接返回
    if (existsSync(cachePath)) {
      return fsp.readFile(cachePath);
    }

    try {
      const buffer = await sharp(srcPath).resize({ width }).jpeg({ quality: 85 }).toBuffer();
      await fsp.writeFile(cachePath, buffer).catch(() => undefined);
      return buffer;
    } catch (error) {
      throw AppException.badRequest(`图片缩放失败: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    const fileName = path.basename(req.path);
    // 仅处理常见图片扩展名
    if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName)) {
      next();
      return;
    }

    try {
      const buffer = await this.imageScaleService.scale(fileName, Math.floor(width));
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buffer);
    } catch {
      // 缩放失败不阻断：回退到原图
      next();
    }
  }
}
