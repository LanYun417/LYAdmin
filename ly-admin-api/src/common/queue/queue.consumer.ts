/**
 * 队列消费调度器：周期性领取到期任务。
 *
 * 为什么不用 @Cron 装饰器：cron 表达式写在代码里，而消费节奏（30s）属于可运维参数；
 * 用 SchedulerRegistry 动态注册 + Interval，与 TaskModule 的「cron 来自配置」口径一致。
 * 单实例部署这就是全部；多实例时 consumeDue 的条件更新天然串行化，无需选主。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QueueService } from './queue.service.js';

/** 消费间隔（毫秒）：30s 平衡及时性与空转开销。 */
const CONSUME_INTERVAL_MS = 30_000;
/** 调度器名称（SchedulerRegistry 的 key，卸载时摘除）。 */
const JOB_NAME = 'queue:consume-due';

@Injectable()
export class QueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueConsumer.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: QueueService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // 注册即启动：首次延迟半个周期执行，避开应用启动期的资源竞争
    this.timer = setInterval(() => {
      void this.tick();
    }, CONSUME_INTERVAL_MS);
    // unref：不阻止进程退出（测试/e2e 需要）
    this.timer.unref();
    try {
      this.schedulerRegistry.addInterval(JOB_NAME, this.timer as never);
    } catch {
      // 已存在（热重载）时忽略
    }
    this.logger.log(`队列消费调度已启动（每 ${CONSUME_INTERVAL_MS / 1000}s 一批）`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      this.schedulerRegistry.deleteInterval(JOB_NAME);
    } catch {
      // 未注册时忽略
    }
  }

  /** 单次消费：异常只记日志，绝不让定时器崩掉。 */
  private async tick(): Promise<void> {
    try {
      const result = await this.queue.consumeDue();
      if (result.processed > 0) {
        this.logger.log(
          `队列消费：处理 ${result.processed} 个（成功 ${result.succeeded} / 失败待重试 ${result.failed} / 放弃 ${result.dead}）`,
        );
      }
    } catch (error) {
      this.logger.error(`队列消费异常：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
