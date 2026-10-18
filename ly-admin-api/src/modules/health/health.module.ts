/**
 * 健康检查模块。
 * 模块职责：装配 live / ready 探针控制器（依赖 Prisma 与 Redis，均由全局 CommonModule 提供）。
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
