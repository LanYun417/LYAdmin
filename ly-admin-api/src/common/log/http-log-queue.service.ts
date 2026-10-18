/**
 * HTTP 访问日志写入缓冲。
 * 模块职责：把「每个请求一条 INSERT」合并为 `createMany` 批量写入，降低数据库往返与连接占用。
 *
 * 设计取舍：
 * - 访问日志属于**可丢失**的观测数据，进程崩溃时最多丢最后一个刷盘窗口，故不做持久化重试；
 * - 队列达到阈值立即写，否则 500ms 定时写；`onModuleDestroy` 时强制 flush，正常退出不丢尾部；
 * - 写入失败只记 warn，不影响任何业务响应。
 */
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** 定时刷盘间隔（毫秒）。 */
const FLUSH_INTERVAL_MS = 500;

/** 达到该条数立即刷盘。 */
const FLUSH_THRESHOLD = 50;

@Injectable()
export class HttpLogQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(HttpLogQueueService.name);
  private readonly buffer: Prisma.HttpLogCreateManyInput[] = [];
  private timer: NodeJS.Timeout | null = null;
  private pendingFlush: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** 入队一条访问日志。 */
  enqueue(record: Prisma.HttpLogCreateManyInput): void {
    this.buffer.push(record);
    if (this.buffer.length >= FLUSH_THRESHOLD) {
      void this.flush();
      return;
    }
    this.schedule();
  }

  /** 安排一次定时刷盘（已有定时器时不重复安排）。 */
  private schedule(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    // 不因未刷盘的定时器阻止进程退出（退出前 onModuleDestroy 会再 flush 一次）
    this.timer.unref();
  }

  /** 刷盘；已有写入在途时复用同一个 Promise，保证 onModuleDestroy 能等到真正写完。 */
  flush(): Promise<void> {
    if (this.pendingFlush) {
      return this.pendingFlush;
    }
    if (this.buffer.length === 0) {
      return Promise.resolve();
    }
    const batch = this.buffer.splice(0, this.buffer.length);
    this.pendingFlush = this.writeBatch(batch).finally(() => {
      this.pendingFlush = null;
      if (this.buffer.length >= FLUSH_THRESHOLD) {
        void this.flush();
      } else if (this.buffer.length > 0) {
        this.schedule();
      }
    });
    return this.pendingFlush;
  }

  /** 写入一批日志（失败只告警，不抛出）。 */
  private async writeBatch(batch: Prisma.HttpLogCreateManyInput[]): Promise<void> {
    try {
      await this.prisma.httpLog.createMany({ data: batch });
    } catch (error) {
      this.logger.warn(
        `批量写入 HTTP 日志失败（丢弃 ${batch.length} 条）: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
