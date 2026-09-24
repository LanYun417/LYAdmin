/**
 * Express 应用装配。
 * 模块职责：创建应用实例、挂载全局中间件（cors/morgan/json/静态目录/操作日志）、业务路由与错误处理。
 */
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import morgan from 'morgan';
import { config } from '@/config';
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

  app.set('trust proxy', true);
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

  // 404 与统一错误处理
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
