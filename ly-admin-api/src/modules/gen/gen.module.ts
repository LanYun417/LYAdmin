/**
 * 代码生成模块。
 * 模块职责：装配 gen 模块的控制器、服务与落盘器（PrismaService 由全局 PrismaModule 提供）。
 */
import { Module } from '@nestjs/common';
import { GenController } from './gen.controller.js';
import { GenService } from './gen.service.js';
import { GenWriter } from './gen.writer.js';

@Module({
  controllers: [GenController],
  providers: [GenService, GenWriter],
})
export class GenModule {}
