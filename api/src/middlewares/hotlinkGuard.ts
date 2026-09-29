/**
 * 静态资源防盗链中间件。
 * 模块职责：校验 `/uploads` 请求的 Referer，阻止**外部站点**把本站资源嵌到自己的页面里白嫖流量。
 *
 * 与鉴权无关：本中间件**不做登录校验**。防盗链只解决「别的网站盗用你的图片/文件」，
 * 不解决「未登录用户直接打开直链」——后者是访问控制范畴，需另行加鉴权，两者互不依赖。
 *
 * 放行规则（对齐 Nginx `valid_referers none blocked server_names` 的通行策略）：
 * 1. **无 Referer**（`none`）：直接访问、被隐私策略剥离、部分下载工具——按行业惯例放行；
 * 2. **同源**（`server_names`）：Referer 的 host 与本次请求 host 一致（同源部署时的正常引用）；
 * 3. **白名单**：命中 `config.upload.allowedReferers`（前后端分离/多域名部署时把前端 origin 配进来）。
 * 其余一律 403。
 */
import type { NextFunction, Request, Response } from 'express';
import { config } from '@/config';

/** 从 Referer 中解析 host（归一为小写）；解析失败返回空串。 */
function resolveRefererHost(referer: string): string {
  try {
    return new URL(referer).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * 防盗链校验。
 * 挂载位置：必须位于 `express.static` 之前，例如
 * `app.use('/uploads', hotlinkGuard, imageScaleMiddleware(), express.static(config.upload.dir))`。
 */
export function hotlinkGuard(req: Request, res: Response, next: NextFunction): void {
  const referer = req.headers.referer ?? '';

  // 无 Referer：直接访问 / 隐私策略剥离，非外链，放行
  if (!referer) {
    next();
    return;
  }

  const refererHost = resolveRefererHost(referer);
  // Referer 存在但解析不出 host（`blocked`：被防火墙/代理剥离），按惯例放行
  if (!refererHost) {
    next();
    return;
  }

  const selfHost = String(req.headers.host ?? '').toLowerCase();
  if (refererHost === selfHost || config.upload.allowedReferers.includes(refererHost)) {
    next();
    return;
  }

  res.status(403).type('text/plain; charset=utf-8').send('403 Forbidden：禁止外链引用该资源');
}
