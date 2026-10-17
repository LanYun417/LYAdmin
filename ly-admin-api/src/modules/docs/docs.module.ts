/**
 * 接口文档模块。
 * 模块职责：注册接口文档控制器（数据由构建期生成，模块内无服务依赖）。
 */
import { Module } from '@nestjs/common';
import { DocsController } from './docs.controller.js';

@Module({
  controllers: [DocsController],
})
export class DocsModule {}
