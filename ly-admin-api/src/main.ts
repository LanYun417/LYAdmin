/**
 * 服务入口。
 * 模块职责：用 Express 适配器创建应用、按共用口径装配（见 `app.setup.ts`）并监听端口。
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { config } from './common/config.js';
import { OkExpressAdapter } from './common/ok-express.adapter.js';

async function bootstrap(): Promise<void> {
  // 传入自定义适配器：成功响应恒回 HTTP 200（POST 不回 201）
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new OkExpressAdapter());

  // 与 e2e 测试共用同一份装配（前缀 / CORS / body 上限 / 校验管道 / 静态资源）
  configureApp(app, { serveStatic: true });

  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(`服务已启动: http://localhost:${config.port}/api`);
  logger.log(`健康检查: GET http://localhost:${config.port}/api`);
}

void bootstrap();
