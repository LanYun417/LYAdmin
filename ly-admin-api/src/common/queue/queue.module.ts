/**
 * 通用任务队列模块。
 * 模块职责：队列服务（入队/消费/重放）+ 周期消费调度 + 分布式锁。
 *
 * 调度口径：每 30s 领取一批到期任务（单批 5 个）。消费本身由数据库条件更新
 * 串行化，多实例部署时也只有一个实例能领走同一任务，无需额外选主编队。
 */
import { Module } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';
import { QueueConsumer } from './queue.consumer.js';
import { DistributedLock } from './distributed-lock.js';

@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [QueueService, QueueConsumer, DistributedLock, SchedulerRegistry],
  exports: [QueueService, DistributedLock],
})
export class QueueModule {}
