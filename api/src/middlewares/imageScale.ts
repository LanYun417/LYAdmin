/**
 * 图片按需缩放中间件。
 * 模块职责：拦截 `/uploads` 下的静态资源请求，若带合法 `?scale=` 且目标为图片，
 * 则返回等比缩放后的缓存图片；不适用（无参数/非法/非图片/越界/异常）时调用 next()
 * 交由后续 express.static 出原图，绝不因缩放失败导致图片不可访问。
 */
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '@/config';
import { getImageMimeType, getScaledImage, isImageFile, parseScale } from '@/services/image.service';

/** 静态资源根目录（绝对路径）。 */
const UPLOAD_ROOT = path.resolve(config.upload.dir);

/** 根目录前缀（末尾带分隔符），用于路径越界校验。 */
const UPLOAD_ROOT_PREFIX = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep;

/** 缩放图片的浏览器缓存时长（秒）：7 天。 */
const CACHE_MAX_AGE = 604800;

/**
 * 将请求相对路径解析为上传根目录内的绝对路径，并校验不越界（防目录穿越）。
 * 中间件挂载在 `/uploads` 下，`req.path` 已是去掉挂载前缀的相对路径（如 `/xxx.png`）。
 * @param reqPath 请求相对路径
 * @returns 合法且在根目录内返回绝对路径；越界/非法返回 null
 */
function resolveSafePath(reqPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch {
    return null;
  }

  // 归一化为「以 / 开头的相对路径」，再基于根目录解析为绝对路径
  const relative = decoded.startsWith('/') ? decoded : `/${decoded}`;
  const absolute = path.resolve(UPLOAD_ROOT, `.${relative}`);

  // 允许等于根目录本身或位于根目录之下；否则视为越界
  if (absolute !== UPLOAD_ROOT && !absolute.startsWith(UPLOAD_ROOT_PREFIX)) {
    return null;
  }
  return absolute;
}

/**
 * 创建图片按需缩放中间件。
 * 用法：`app.use('/uploads', imageScaleMiddleware(), express.static(config.upload.dir))`
 * @returns Express 请求处理中间件
 */
export function imageScaleMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 仅处理 GET / HEAD，其余方法直接放行
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    // 解析缩放参数：缺省或非法 → 原图（交给 static）
    const scale = parseScale(req.query.scale);
    if (scale === null) {
      next();
      return;
    }

    try {
      // 解析并校验目标路径（防目录穿越）
      const absolutePath = resolveSafePath(req.path);
      if (absolutePath === null) {
        res.status(404).end();
        return;
      }

      // 非图片忽略参数
      if (!isImageFile(absolutePath)) {
        next();
        return;
      }

      // 目标必须是存在的普通文件，否则交给 static（由其决定 404 或其它行为）
      let stat: fs.Stats;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        next();
        return;
      }
      if (!stat.isFile()) {
        next();
        return;
      }

      // 生成/复用缩放图片（内部已保证异常回退原图路径）
      const resultPath = await getScaledImage(absolutePath, scale);

      res.sendFile(
        resultPath,
        {
          headers: {
            'Content-Type': getImageMimeType(resultPath),
            'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
          },
        },
        (error?: Error): void => {
          // 发送阶段出错且响应尚未开始时，回退给 static 出原图
          if (error && !res.headersSent) {
            next();
          }
        },
      );
    } catch (error) {
      // 任何异常都回退原图，绝不因缩放失败导致图片 404
      console.error('[ImageScale] 处理缩放请求失败，回退原图:', error);
      next();
    }
  };
}
