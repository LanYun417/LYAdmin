/**
 * 通用任务队列服务。
 * 模块职责：入队（幂等）、消费执行（分布式锁 + 指数退避重试）、僵尸任务回收。
 *
 * 消费模型（刻意简单）：
 * - 单实例：进程内 ticker（@nestjs/schedule）周期性领取；
 * - 多实例：领取用「UPDATE … WHERE id IN (SELECT …) 」式的条件更新占位
 *   （attempts 自增 + status=running + startedAt），天然只有一个实例能改成功，
 *   不依赖分布式锁即可安全并发消费；分布式锁留给「同一任务类型全局只允许一个实例跑」的场景。
 *
 * 重试口径：指数退避 base = 30s，availAt = now + base * 2^(attempts-1)，
 * 超过 maxAttempts 进入 dead（保留记录供人工重放）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../exception/app.exception.js';
import { buildPageResult, parsePagination } from '../utils/utils.js';
import type { PageResult } from '../types.js';

/** 退避基数（毫秒）。 */
const BACKOFF_BASE_MS = 30_000;
/** 单次消费批大小。 */
const BATCH_SIZE = 5;
/** running 超过该时长未更新视为僵尸（执行进程崩溃），可被重新领取。 */
const ZOMBIE_TIMEOUT_MS = 10 * 60_000;

/** 任务处理器（按 type 注册）。 */
export type JobHandler = (payload: Record<string, unknown>, ctx: { jobId: number; attempt: number }) => Promise<void>;

/** 对外任务 DTO。 */
export interface QueueJobItem {
  id: number;
  type: string;
  title: string;
  payload: unknown;
  idemKey: string;
  maxAttempts: number;
  attempts: number;
  status: string;
  availAt: Date;
  lastError: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdBy: number;
  createdAt: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  /** type → 处理器（由各业务模块在 onModuleInit 注册）。 */
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly prisma: PrismaService) {}

  /** 注册某类任务的处理器（重复注册后者覆盖前者，便于测试与热替换）。 */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * 入队。
   * @param input.idemKey 幂等键：同键已在库（任何状态）直接返回已有任务，不重复执行
   * @returns 新任务或幂等命中的既有任务
   */
  async enqueue(input: {
    type: string;
    title: string;
    payload: Record<string, unknown>;
    idemKey?: string;
    maxAttempts?: number;
    createdBy?: number;
  }): Promise<QueueJobItem> {
    if (!this.handlers.has(input.type)) {
      throw AppException.badRequest(`未注册的任务类型：${input.type}`);
    }
    const idemKey = input.idemKey ?? '';
    if (idemKey) {
      const existing = await this.prisma.queueJob.findUnique({ where: { idemKey } });
      if (existing) {
        return this.toItem(existing);
      }
    }
    const row = await this.prisma.queueJob.create({
      data: {
        type: input.type,
        title: input.title,
        payload: JSON.stringify(input.payload ?? {}),
        idemKey,
        maxAttempts: input.maxAttempts && input.maxAttempts > 0 ? input.maxAttempts : 3,
        createdBy: BigInt(input.createdBy ?? 0),
      },
    });
    this.logger.log(`入队任务 #${row.id}（${input.type}）${idemKey ? `，幂等键 ${idemKey}` : ''}`);
    return this.toItem(row);
  }

  /** 手动重放：把 dead / done 的任务重置为 pending（生成新尝试起点）。 */
  async replay(id: number): Promise<QueueJobItem> {
    const row = await this.prisma.queueJob.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('任务不存在');
    }
    if (row.status === 'running') {
      throw AppException.conflict('任务正在执行中，暂不能重放');
    }
    const updated = await this.prisma.queueJob.update({
      where: { id: BigInt(id) },
      data: {
        status: 'pending',
        attempts: 0,
        availAt: new Date(),
        lastError: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    return this.toItem(updated);
  }

  /** 分页列表。 */
  async list(query: Record<string, unknown>): Promise<PageResult<QueueJobItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const status = typeof query.status === 'string' ? query.status : '';
    const type = typeof query.type === 'string' ? query.type : '';
    const where = {
      ...(status ? { status } : {}),
      ...(type ? { type: { contains: type } } : {}),
    };
    const [rows, count] = await Promise.all([
      this.prisma.queueJob.findMany({ where, orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.queueJob.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      count,
      page,
      pageSize,
    );
  }

  /**
   * 僵尸回收：running 超过 {@link ZOMBIE_TIMEOUT_MS} 的任务打回 pending。
   * 场景：执行实例崩溃 / OOM，任务永远停在 running 没人收尾。
   * 该次尝试已计入 attempts（「崩了也算一次失败」，避免无限重试口径）。
   */
  async reclaimZombies(): Promise<number> {
    const before = new Date(Date.now() - ZOMBIE_TIMEOUT_MS);
    const result = await this.prisma.queueJob.updateMany({
      where: { status: 'running', startedAt: { lt: before } },
      data: { status: 'pending', availAt: new Date() },
    });
    return Number(result.count ?? 0);
  }

  /**
   * 消费一批可执行任务（由调度器周期性调用）。
   *
   * 领取口径（status=pending AND availAt<=now）：
   * - 首次与重试（backoff 到期）任务都参与领取；
   * - 「僵尸」由 status=running + startedAt 超过 {@link ZOMBIE_TIMEOUT_MS} 判定，
   *   领取只认 pending 天然排除 running；reclaimZombies 负责把崩溃残留打回 pending；
   * - 领取用条件更新（pending → running + attempts+1 + startedAt），数据库行锁天然
   *   串行化，多实例并发也只有一个实例能改成功。
   * @returns 本次处理的任务数（含成功与失败）
   */
  async consumeDue(): Promise<{ processed: number; succeeded: number; failed: number; dead: number }> {
    // 先把崩溃残留的僵尸任务打回 pending（执行进程挂了，running 永远等不到人收尾）
    await this.reclaimZombies();
    const now = new Date();
    const candidates = await this.prisma.queueJob.findMany({
      where: { status: 'pending', availAt: { lte: now } },
      orderBy: { availAt: 'asc' },
      take: BATCH_SIZE,
    });
    let succeeded = 0;
    let failed = 0;
    let dead = 0;
    for (const job of candidates) {
      const nextAttempt = Number(job.attempts) + 1;
      // 占位更新：条件收敛到「仍是我预期的状态」，避免与 replay/manual 操作竞争
      const claim = await this.prisma.queueJob.updateMany({
        where: { id: job.id, status: 'pending' },
        data: { status: 'running', attempts: nextAttempt, startedAt: now },
      });
      if (claim.count === 0) {
        continue; // 已被其他实例/操作领走
      }
      try {
        const handler = this.handlers.get(job.type);
        if (!handler) {
          throw new Error(`未注册的任务类型：${job.type}`);
        }
        const payload = this.parsePayload(job.payload);
        await handler(payload, { jobId: Number(job.id), attempt: nextAttempt });
        await this.prisma.queueJob.update({
          where: { id: job.id },
          data: { status: 'done', finishedAt: new Date(), lastError: null },
        });
        succeeded += 1;
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        const nextAvail = new Date(now.getTime() + BACKOFF_BASE_MS * 2 ** Math.max(0, nextAttempt - 1));
        if (nextAttempt >= Number(job.maxAttempts)) {
          await this.prisma.queueJob.update({
            where: { id: job.id },
            data: { status: 'dead', lastError: message, finishedAt: new Date() },
          });
          dead += 1;
          this.logger.warn(`任务 #${job.id}（${job.type}）第 ${nextAttempt} 次尝试仍失败，进入 dead：${message}`);
        } else {
          await this.prisma.queueJob.update({
            where: { id: job.id },
            data: { status: 'pending', lastError: message, availAt: nextAvail },
          });
          failed += 1;
          this.logger.warn(
            `任务 #${job.id}（${job.type}）第 ${nextAttempt} 次失败，${nextAvail.toISOString()} 后重试：${message}`,
          );
        }
      }
    }
    return { processed: candidates.length, succeeded, failed, dead };
  }

  /** 解析 payload（坏 JSON 归一为空对象，不让脏数据把任务卡死）。 */
  private parsePayload(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private toItem(row: {
    id: bigint;
    type: string;
    title: string;
    payload: string;
    idemKey: string;
    maxAttempts: number;
    attempts: number;
    status: string;
    availAt: Date;
    lastError: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdBy: bigint;
    createdAt: Date;
  }): QueueJobItem {
    return {
      id: Number(row.id),
      type: row.type,
      title: row.title,
      payload: this.parsePayload(row.payload),
      idemKey: row.idemKey,
      maxAttempts: Number(row.maxAttempts),
      attempts: Number(row.attempts),
      status: row.status,
      availAt: row.availAt,
      lastError: row.lastError,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdBy: Number(row.createdBy),
      createdAt: row.createdAt,
    };
  }
}
