/**
 * Express 应用装配。
 * 模块职责：创建应用实例、挂载全局中间件（cors/morgan/json/静态目录/操作日志）、业务路由与错误处理。
 */
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import morgan from 'morgan';
import { config } from '@/config';
import { registerDocsRoutes } from '@/docs';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
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
  // 图片按需缩放中间件须在 static 之前：命中合法 ?scale= 且为图片时返回缩放结果，
  // 否则 next() 交由 static 出原图。
  app.use('/uploads', imageScaleMiddleware(), express.static(config.upload.dir));

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

  // 404 与统一错误处理
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
