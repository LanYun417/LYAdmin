/**
 * 定时任务服务。
 * 模块职责：把任务注册表注册到 SchedulerRegistry、执行任务并落执行记录、对外提供查询。
 *
 * 三件事的边界：
 * - **注册**（onModuleInit）：按注册表逐个建 cron 任务；已停用的任务不注册。
 * - **执行**（runTask）：自动触发与手动触发走同一条路径，保证执行记录口径一致。
 * - **查询**（listTasks / listTaskLogs）：管理端读执行记录与调度状态。
 *
 * 关于「启动补跑」：cron 只能按点触发，若服务在计划时刻之后才启动，当天那次就会漏掉
 * （日志归档尤其不能漏——昨天的日志会一直堆着）。故启动时会补跑一次：
 * 若「该任务本调度周期内尚无成功执行记录」，则立即执行一次。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TaskRunStatus, TaskTrigger } from '../../common/config/constants.js';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileLoggerService } from '../../common/log/file-logger.service.js';
import { ImageScaleService } from '../../common/file/file-guards.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import { buildTaskRegistry, cronOf, type TaskContext, type TaskDefinition, type TaskDeps } from './task.registry.js';

/** 任务列表项（管理端展示）。 */
export interface TaskItem {
  /** 任务标识 */
  name: string;
  /** 任务名称 */
  title: string;
  /** 任务说明 */
  description: string;
  /** cron 表达式（6 位：秒 分 时 日 月 周） */
  cron: string;
  /** 是否启用（false = 已停用，不参与调度） */
  enabled: boolean;
  /** 下次执行时间；已停用为 null */
  nextRunAt: Date | null;
  /** 是否正在执行中 */
  running: boolean;
  /** 上次执行摘要（从未执行过为 null） */
  lastRun: TaskRunSummary | null;
}

/** 单次执行的摘要。 */
export interface TaskRunSummary {
  /** 执行状态 */
  status: TaskRunStatus;
  /** 触发方式 */
  trigger: TaskTrigger;
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间（执行中为 null） */
  finishedAt: Date | null;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 失败原因 */
  errorMessage: string | null;
  /** 手动触发人账号 */
  operator: string | null;
}

/** 执行记录列表项。 */
export interface TaskLogItem extends TaskRunSummary {
  id: number;
  /** 任务标识 */
  taskName: string;
  /** 任务名称（快照） */
  taskTitle: string;
}

/** 手动执行的结果。 */
export interface TaskRunResult {
  /** 任务标识 */
  name: string;
  /** 任务名称 */
  title: string;
  /** 执行状态 */
  status: TaskRunStatus;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 失败原因（成功为 null） */
  errorMessage: string | null;
  /** 开始时间 */
  startedAt: Date;
  /** 结束时间 */
  finishedAt: Date;
}

/**
 * 读取查询串里的整数筛选值。
 * 空值返回 undefined（表示不筛选）；非数字返回 undefined 而不是 NaN——
 * NaN 传给 Prisma 会抛出难以理解的类型错误，忽略非法值更符合「筛选条件不匹配」的语义。
 */
function readFilterNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 任务执行体的依赖（由本服务注入真实实现后传给注册表工厂）。 */
@Injectable()
export class TaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskService.name);
  /** 任务定义表（name → 定义） */
  private readonly definitions = new Map<string, TaskDefinition>();
  /** 正在执行中的任务名（防同任务重入） */
  private readonly running = new Set<string>();
  /** 任务依赖（延迟到 onModuleInit 组装，避免构造期注入顺序问题） */
  private deps: TaskDeps | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly fileLogger: FileLoggerService,
    private readonly imageScale: ImageScaleService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.deps = {
      archiveLogs: () => this.fileLogger.archiveYesterday(),
      cleanLogs: () => this.fileLogger.cleanExpiredLogs(),
      sweepImageCache: async () => {
        await this.imageScale.sweep();
      },
    };

    const registry = buildTaskRegistry();
    for (const item of registry) {
      const definition: TaskDefinition = {
        name: item.name,
        title: item.title,
        description: item.description,
        schedule: item.schedule,
        cron: cronOf(item.schedule),
        enabled: item.enabled,
        handler: item.create(this.deps),
      };
      this.definitions.set(definition.name, definition);

      if (!definition.enabled) {
        this.logger.warn(`[Task] 任务「${definition.title}」已停用，不注册调度`);
        continue;
      }

      // 动态注册：cron 表达式来自配置（运行时才知道），故不能用 @Cron 装饰器
      const job = CronJob.from({
        cronTime: definition.cron,
        onTick: () => {
          void this.runTask(definition.name, TaskTrigger.AUTO, null);
        },
        start: true,
        name: definition.name,
        // 任务执行完才允许下一次触发：慢任务（如大批量删日志）不会因时间点密集而叠加
        waitForCompletion: true,
      });
      this.schedulerRegistry.addCronJob(definition.name, job);
      this.logger.log(
        `[Task] 已注册定时任务「${definition.title}」(cron: ${definition.cron})，下次执行 ${job.nextDate().toISO()}`,
      );
    }

    await this.catchUpMissedTasks();
  }

  onModuleDestroy(): void {
    // 主动摘除自己注册的 cron 任务：SchedulerRegistry 的清理只覆盖 @Cron 装饰器注册的那批
    for (const name of this.definitions.keys()) {
      if (this.schedulerRegistry.doesExist('cron', name)) {
        this.schedulerRegistry.deleteCronJob(name);
      }
    }
    this.definitions.clear();
  }

  /**
   * 启动补跑：对每个已启用的任务，若「本调度周期内尚无成功执行记录」，则立即执行一次。
   *
   * 判定「本调度周期」的口径：
   * - 每日任务（daily）：看**今天**的计划时刻是否已过，且今天没有成功记录；
   * - 周期任务（everyHours）：看距上次成功执行是否已超过一个周期；从未执行过则补跑。
   *
   * 补跑失败不影响启动（只记日志），否则一个任务失败会带崩整个服务。
   */
  private async catchUpMissedTasks(): Promise<void> {
    for (const definition of this.definitions.values()) {
      if (!definition.enabled) {
        continue;
      }
      const lastSuccess = await this.findLastSuccess(definition.name);
      const needCatchUp = this.shouldCatchUp(definition, lastSuccess);
      if (!needCatchUp) {
        continue;
      }
      this.logger.log(`[Task] 任务「${definition.title}」本周期尚未成功执行，启动时补跑一次`);
      // 不静默吞掉异常：补跑失败必须留下痕迹，否则运维会以为「已补跑」而实际什么都没发生
      void this.runTask(definition.name, TaskTrigger.AUTO, null).catch((error: unknown) => {
        this.logger.error(
          `[Task] 任务「${definition.title}」启动补跑失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }
  }

  /**
   * 判断任务是否需要启动补跑。
   * @param definition 任务定义
   * @param lastSuccess 最近一次成功执行的开始时间（无则 null）
   */
  private shouldCatchUp(definition: TaskDefinition, lastSuccess: Date | null): boolean {
    const schedule = definition.schedule;
    if (schedule.kind === 'daily') {
      const now = new Date();
      const pastScheduledTime =
        now.getHours() > schedule.hour || (now.getHours() === schedule.hour && now.getMinutes() >= schedule.minute);
      if (!pastScheduledTime) {
        return false;
      }
      // 今天还没成功过 → 补跑（跨天则 lastSuccess 必然是昨天之前，自然为 true）
      return !lastSuccess || this.isBeforeToday(lastSuccess);
    }
    // 周期任务：距上次成功超过一个周期即补跑
    if (!lastSuccess) {
      return true;
    }
    const elapsedHours = (Date.now() - lastSuccess.getTime()) / 3_600_000;
    return elapsedHours >= schedule.hours;
  }

  /** 判断时间是否早于今天 00:00（本地时区）。 */
  private isBeforeToday(value: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return value.getTime() < today.getTime();
  }

  /** 查某任务最近一次**成功**执行的开始时间。 */
  private async findLastSuccess(taskName: string): Promise<Date | null> {
    const row = await this.prisma.taskLog.findFirst({
      where: { taskName, status: TaskRunStatus.SUCCESS },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    return row?.startedAt ?? null;
  }

  /**
   * 执行任务（自动与手动共用同一路径）。
   *
   * 步骤：占用执行位 → 落一条 RUNNING 记录 → 执行 → 更新记录为终态 → 释放执行位。
   *
   * @param name 任务标识
   * @param trigger 触发方式
   * @param operator 手动触发人账号（自动触发传 null）
   */
  async runTask(name: string, trigger: TaskTrigger, operator: string | null): Promise<TaskRunResult> {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw AppException.notFound('定时任务不存在');
    }
    if (!definition.enabled) {
      throw AppException.badRequest('该定时任务已停用，无法执行');
    }
    if (this.running.has(name)) {
      throw AppException.conflict('该任务正在执行中，请稍后再试');
    }

    this.running.add(name);
    const startedAt = new Date();
    const ctx: TaskContext = { name: definition.name, title: definition.title };

    // 先落 RUNNING 记录：任务执行期间即便进程被杀，也能在列表上看出「卡在哪」
    const logId = await this.prisma.taskLog.create({
      data: {
        taskName: definition.name,
        taskTitle: definition.title,
        triggerType: trigger,
        status: TaskRunStatus.RUNNING,
        startedAt,
        operator,
      },
      select: { id: true },
    });

    try {
      await definition.handler(ctx);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      await this.finishLog(logId.id, TaskRunStatus.SUCCESS, finishedAt, durationMs, null);
      this.logger.log(`[Task] 任务「${definition.title}」执行成功，耗时 ${durationMs}ms`);
      return {
        name: definition.name,
        title: definition.title,
        status: TaskRunStatus.SUCCESS,
        durationMs,
        errorMessage: null,
        startedAt,
        finishedAt,
      };
    } catch (error) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const message = error instanceof Error ? error.message : String(error);
      await this.finishLog(logId.id, TaskRunStatus.FAILED, finishedAt, durationMs, message.slice(0, 1000));
      this.logger.error(`[Task] 任务「${definition.title}」执行失败: ${message}`);
      // 手动触发时把失败抛给调用方（HTTP 400 + 错误信息）；自动触发时只记日志
      if (trigger === TaskTrigger.MANUAL) {
        throw AppException.badRequest(`任务执行失败：${message}`);
      }
      return {
        name: definition.name,
        title: definition.title,
        status: TaskRunStatus.FAILED,
        durationMs,
        errorMessage: message,
        startedAt,
        finishedAt,
      };
    } finally {
      this.running.delete(name);
    }
  }

  /**
   * 把执行记录更新为终态。
   *
   * 刻意吞掉这里的写库异常：更新失败只意味着「执行记录没写全」，
   * 若让它抛出会**掩盖任务本身的成败**（调用方拿到的是数据库错误而非任务结果），
   * 且自动触发路径下会被上层静默吞掉、表现为「任务永远停在执行中」。
   * 故写库失败只记日志，任务结果照常返回。
   */
  private async finishLog(
    id: bigint,
    status: TaskRunStatus,
    finishedAt: Date,
    durationMs: number,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.prisma.taskLog.update({
        where: { id },
        data: { status, finishedAt, duration: durationMs, errorMessage },
      });
    } catch (error) {
      this.logger.error(`[Task] 写入执行记录终态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 任务列表（含调度状态与上次执行摘要）。 */
  async listTasks(): Promise<TaskItem[]> {
    const items: TaskItem[] = [];
    for (const definition of this.definitions.values()) {
      const lastRun = await this.findLastRun(definition.name);
      let nextRunAt: Date | null = null;
      if (definition.enabled && this.schedulerRegistry.doesExist('cron', definition.name)) {
        // nextDate() 返回 luxon DateTime，转成原生 Date 供接口序列化
        nextRunAt = this.schedulerRegistry.getCronJob(definition.name).nextDate().toJSDate();
      }
      items.push({
        name: definition.name,
        title: definition.title,
        description: definition.description,
        cron: definition.cron,
        enabled: definition.enabled,
        nextRunAt,
        running: this.running.has(definition.name),
        lastRun,
      });
    }
    return items;
  }

  /** 查某任务最近一次执行（不论成败）。 */
  private async findLastRun(taskName: string): Promise<TaskRunSummary | null> {
    const row = await this.prisma.taskLog.findFirst({
      where: { taskName },
      orderBy: { startedAt: 'desc' },
    });
    if (!row) {
      return null;
    }
    return {
      status: row.status as TaskRunStatus,
      trigger: row.triggerType as TaskTrigger,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.duration,
      errorMessage: row.errorMessage,
      operator: row.operator,
    };
  }

  /** 某任务的执行记录（分页）。 */
  async listTaskLogs(
    taskName: string,
    query: Record<string, unknown>,
  ): Promise<{ list: TaskLogItem[]; total: number; page: number; pageSize: number }> {
    if (!this.definitions.has(taskName)) {
      throw AppException.notFound('定时任务不存在');
    }
    const { page, pageSize, offset, limit } = parsePagination(query);

    const where: Record<string, unknown> = { taskName };
    const status = readFilterNumber(query.status);
    if (status !== undefined) {
      where.status = status;
    }
    const trigger = readFilterNumber(query.trigger);
    if (trigger !== undefined) {
      where.triggerType = trigger;
    }

    const [rows, total] = await Promise.all([
      this.prisma.taskLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.taskLog.count({ where }),
    ]);

    const list: TaskLogItem[] = rows.map((row) => ({
      id: Number(row.id),
      taskName: row.taskName,
      taskTitle: row.taskTitle,
      status: row.status as TaskRunStatus,
      trigger: row.triggerType as TaskTrigger,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.duration,
      errorMessage: row.errorMessage,
      operator: row.operator,
    }));

    return buildPageResult(list, total, page, pageSize);
  }

  /** 任务说明文案（供接口文档与调试使用）。 */
  describeTasks(): Array<{ name: string; title: string; cron: string; enabled: boolean }> {
    return [...this.definitions.values()].map((definition) => ({
      name: definition.name,
      title: definition.title,
      cron: definition.cron,
      enabled: definition.enabled,
    }));
  }
}
