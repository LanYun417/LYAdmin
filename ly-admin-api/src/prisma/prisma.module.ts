/**
 * PrismaModule：全局数据库模块。
 * 模块职责：以全局提供者形式导出 PrismaService，使业务模块无需逐个 import 即可注入；
 * 并注册 SeedService —— 它实现 OnApplicationBootstrap，在服务开始监听前执行幂等种子，
 * 对齐原 Express 版 server.ts 中 `await runSeed()` 的时机。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { SeedService } from './seed.service.js';

@Global()
@Module({
  providers: [PrismaService, SeedService],
  exports: [PrismaService],
})
export class PrismaModule {}
