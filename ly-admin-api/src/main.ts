/**
 * 服务入口。
 * 模块职责：装配 Express 适配器（全局前缀 / CORS / 校验管道 / 静态资源与前端产物托管）并监听。
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { config } from './common/config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // 反向代理信任跳数：仅在显式配置时信任 X-Forwarded-For（默认不信任，防伪造 IP 绕过限流）
  app.set('trust proxy', config.trustProxy);

  // 隐藏框架标识
  app.disable('x-powered-by');

  // 关闭 etag：避免动态响应产生 304（304 无响应体，axios 只把 2xx 视为成功）
  app.disable('etag');

  // 全局路由前缀：前端 baseURL 为 /api
  app.setGlobalPrefix('api');

  // 跨域：开发期前端走 Vite 代理，此处便于直连调试
  app.enableCors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((item) => item.trim()),
    credentials: true,
  });

  // 请求体上限 2mb（与原版一致）
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '2mb', extended: true });

  // 全局校验管道：class-validator 失败交由 AllExceptionsFilter 统一转 400
  app.useGlobalPipes(
    new ValidationPipe({
      // 剥离未知字段（防越权字段注入，如前端误传 roleCode / systemFlag）
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 上传静态资源：鉴权 / 防盗链 / 图片缩放中间件在 AppModule.configure 中挂载
  if (existsSync(config.upload.dir)) {
    app.useStaticAssets(config.upload.dir, { prefix: `/${config.upload.route}/` });
    logger.log(`静态资源目录: ${config.upload.dir} → /${config.upload.route}/`);
  } else {
    logger.warn(`上传目录不存在（${config.upload.dir}），/static 将 404；上传时会自动创建`);
  }

  // 前端构建产物（同源部署）：存在时由后端一并托管，含 history 回退
  if (existsSync(config.web.distDir)) {
    app.useStaticAssets(config.web.distDir);
    // history 回退：非 /api 的页面请求回退 index.html（刷新子路由不 404）
    // 用通配路由 + 运行时判断（Express 5 的 path-to-regexp 需具名通配符 `{*path}`）
    app.getHttpAdapter().get('/{*path}', (req: unknown, res: unknown) => {
      const request = req as { path?: string; url?: string };
      const response = res as {
        status: (code: number) => { json: (body: unknown) => void };
        sendFile: (file: string, opts: { root: string }) => void;
      };
      const path: string = request.path ?? request.url ?? '';
      if (path.startsWith('/api') || path.startsWith(`/${config.upload.route}`)) {
        response.status(404).json({ code: 404, message: '资源不存在', data: null });
        return;
      }
      response.sendFile('index.html', { root: config.web.distDir });
    });
    logger.log(`前端产物已托管: ${config.web.distDir}`);
  }

  await app.listen(config.port);

  logger.log(`服务已启动: http://localhost:${config.port}/api`);
  logger.log(`健康检查: GET http://localhost:${config.port}/api`);
}

void bootstrap();
