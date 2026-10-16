/**
 * PrismaModule：全局数据库模块。
 * 模块职责：以全局提供者形式导出 PrismaService，使业务模块无需逐个 import 即可注入。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
