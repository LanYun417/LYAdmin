/**
 * Express 应用装配。
 * 模块职责：创建应用实例、挂载全局中间件（cors/morgan/json/静态目录/操作日志）、业务路由与错误处理。
 */
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import morgan from 'morgan';
import { config } from '@/config';
import { registerDocsRoutes } from '@/docs';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { authenticateStatic } from '@/middlewares/auth';
import { hotlinkGuard } from '@/middlewares/hotlinkGuard';
import { imageScaleMiddleware } from '@/middlewares/imageScale';
import { operationLog } from '@/middlewares/operationLog';
import routes from '@/routes';
import { httpAccessLogger } from '@/utils/logger';
import { ok } from '@/utils/response';

/**
 * 创建并装配 Express 应用。
 * @returns Express 应用实例
 */
export function createApp(): Express {
  const app = express();

  // 仅在显式配置 TRUST_PROXY（反向代理跳数 > 0）时才信任 X-Forwarded-For。
  // 默认不信任（不调用 set），避免攻击者伪造来源 IP，同时保证 req.ip 返回真实 socket 地址、
  // 登录频率限制（A3）不被绕过。
  if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
  }
  app.disable('x-powered-by');

  // 关闭动态响应的 ETag。
  // 背景：Express 默认给 res.json/res.send 加 ETag，浏览器（以及前端 request.ts 里的
  // If-None-Match 逻辑）会对 /api 的 GET 发条件请求并收到 **304**；而 304 无响应体、
  // axios 默认只把 2xx 视为成功 → 304 落到错误分支，表现为「登录成功但守卫拉取菜单/资料
  // 失败、被弹回 /login」并弹出 `请求失败（304）`。这里从源头关闭，杜绝动态响应产生 304。
  // 静态资源（/uploads、/web 产物）走 express.static 自带的 ETag，不受此处影响。
  app.set('etag', false);

  // 跨域兜底（前端开发期走 Vite 代理，此处便于 Postman/curl 直连）
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );

  // 访问日志：文件（JSON Lines，含请求参数/请求体/响应内容，敏感字段脱敏）+ 控制台
  app.use(httpAccessLogger());
  app.use(morgan('dev'));

  // 请求体解析
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 静态资源：上传目录（Express 5 直接挂载即可，无需通配路由）
  // 顺序：鉴权 → 防盗链 → 图片缩放 → 静态出图。
  // ① 鉴权放最前：仅登录用户可读取上传的文件，杜绝未授权直链访问（P0 安全修复）；
  //    浏览器 <img>/<el-avatar> 无法自动带 Authorization 头，故前端在 URL 上拼 ?token=，
  //    authenticateStatic 会回退读取该查询参数（见 middlewares/auth.ts）。
  // ② 防盗链放鉴权之后，外链请求直接 403，连文件都不必读；
  // ③ 图片按需缩放中间件须在 static 之前：命中合法 ?scale= 且为图片时返回缩放结果，
  //    否则 next() 交由 static 出原图。
  app.use('/static', authenticateStatic, hotlinkGuard, imageScaleMiddleware(), express.static(config.upload.dir));

  // 操作日志（拦截写操作，异步落库）
  app.use(operationLog());

  // 健康检查
  app.get('/api', (_req: Request, res: Response) => {
    ok(res, {
      name: 'ly-admin-api',
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  // 业务路由
  app.use('/api', routes);

  // 零依赖自建接口文档（公开访问，不含敏感信息；路径位于 /api 之外，不与业务路由冲突）
  registerDocsRoutes(app);

  // 前端静态产物（同源部署）：必须挂在业务路由 /uploads /api-docs 之后、404 之前。
  // 命中产物文件则直接出静态资源；未命中的页面请求回退 index.html，保证 Vue Router
  // history 模式下刷新子路由（如 /system/user）不会 404。
  // 产物目录不存在时整体跳过，纯 API 部署场景不受影响。
  if (fs.existsSync(config.web.distDir)) {
    app.use(express.static(config.web.distDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      // 非页面请求（写方法、/api 接口、/uploads、/api-docs）交给后续 404，
      // 绝不能把 JSON 接口回退成 HTML，否则前端拿到的 404 是 HTML 而非统一 JSON 结构
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        next();
        return;
      }
      res.sendFile(path.join(config.web.distDir, 'index.html'));
    });
  }

  // 404 与统一错误处理
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
