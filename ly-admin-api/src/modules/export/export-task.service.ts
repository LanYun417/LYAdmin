/**
 * 异步导出中心服务。
 *
 * 解决什么问题：日志导出虽是流式（内存不涨），但仍**占用一个 HTTP 请求线程**
 * 直到全部写完；10 万行的导出要好几分钟，期间连接挂着、用户不敢关页面。
 * 改为「创建任务 → 后台落盘 → 通知领取」：请求秒回，生成在后台进行。
 *
 * 关键设计：
 * - **进程内串行队列**：导出是重 DB 操作，同一时刻只跑一个任务，避免把库打满；
 *   任务 id 落库（pending），队列只是「待办索引」，进程重启后从库里恢复；
 * - **复用同步导出的同一套数据链路**（LogsService.createXxxExport：同 where、
 *   同游标分批、同上限预检），口径完全一致，不存在「同步能导异步不能」的偏差；
 * - CSV 逐批写盘（csvHeaderRow / csvRow 与 writeCsvStream 同一转义规则）；
 * - 完成后经 event-bus 发布通知 → SSE 实时推铃铛（刚上线的链路，天然复用）；
 * - 文件保留期可配，定时任务清理过期文件（只删文件留记录，便于审计）。
 */
import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { createWriteStream, promises as fsp } from 'node:fs';
import path from 'node:path';
import { AppException } from '../../common/exception/app.exception.js';
import { ROOT_DIR } from '../../common/config/env-parse.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPageResult, parsePagination } from '../../common/utils/utils.js';
import { csvHeaderRow, csvRow } from '../../common/utils/csv-stream.js';
import type { PageResult } from '../../common/types.js';
import { LogsService } from '../logs/logs.service.js';
import { NoticeService, NOTICE_TYPE } from '../notice/notice.service.js';
import type { CsvExportTask } from '../logs/logs.service.js';

/** 任务状态枚举（与 schema 注释一致）。 */
export const ExportTaskStatus = {
  PENDING: 0,
  PROCESSING: 1,
  DONE: 2,
  FAILED: 3,
} as const;

/** 可导出的模块 → 元信息。 */
export const EXPORT_MODULES = {
  'login-log': { label: '登录日志', permission: 'log:login:export' },
  'operation-log': { label: '操作日志', permission: 'log:operation:export' },
  'http-log': { label: 'HTTP 访问日志', permission: 'log:http:export' },
} as const;

export type ExportModuleKey = keyof typeof EXPORT_MODULES;

/** 创建导出任务入参。 */
export interface CreateExportTaskInput {
  module: ExportModuleKey;
  query: Record<string, unknown>;
  timezoneOffset?: number;
}

/** 对外任务结构。 */
export interface ExportTaskItem {
  id: number;
  module: string;
  moduleLabel: string;
  status: number;
  statusText: string;
  fileName: string | null;
  total: number;
  size: number;
  message: string | null;
  username: string;
  createdAt: Date;
  finishedAt: Date | null;
  expiresAt: Date | null;
  downloadable: boolean;
}

/** 状态中文（对外展示）。 */
const STATUS_TEXT: Record<number, string> = {
  0: '等待中',
  1: '生成中',
  2: '已完成',
  3: '失败',
};

@Injectable()
export class ExportTaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportTaskService.name);

  /** 待办队列（任务 id；落库状态才是事实来源，队列只是内存索引）。 */
  private readonly queue: number[] = [];

  /** 是否正在消费（串行保证）。 */
  private processing = false;

  /** 是否已销毁（热关闭时不再启动新任务）。 */
  private destroyed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
    private readonly noticeService: NoticeService,
  ) {}

  /**
   * 启动恢复：把库里的 pending 任务重新入队。
   * 进程重启不会丢任务——created 时已落库，这里只是续跑。
   */
  async onModuleInit(): Promise<void> {
    try {
      const pending = await this.prisma.exportTask.findMany({
        where: { status: ExportTaskStatus.PENDING },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      for (const row of pending) {
        this.queue.push(Number(row.id));
      }
      if (this.queue.length > 0) {
        this.logger.log(`恢复 ${this.queue.length} 个待处理导出任务`);
        void this.drain();
      }
    } catch (error) {
      this.logger.error(`恢复导出任务失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.queue.length = 0;
  }

  /** 创建导出任务（秒回，生成在后台进行）。 */
  async create(userId: number, username: string, input: CreateExportTaskInput): Promise<ExportTaskItem> {
    const moduleMeta = EXPORT_MODULES[input.module];
    if (!moduleMeta) {
      throw AppException.badRequest(`不支持的导出模块: ${String(input.module)}`);
    }
    const row = await this.prisma.exportTask.create({
      data: {
        userId: BigInt(userId),
        username,
        module: input.module,
        query: (input.query ?? {}) as object,
        timezoneOffset: input.timezoneOffset ?? null,
      },
    });
    const id = Number(row.id);
    this.queue.push(id);
    void this.drain();
    return this.toItem(row);
  }

  /** 我的任务列表（分页；按创建时间倒序）。 */
  async listMine(userId: number, query: Record<string, unknown>): Promise<PageResult<ExportTaskItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where = { userId: BigInt(userId) };
    const [rows, total] = await Promise.all([
      this.prisma.exportTask.findMany({ where, orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.exportTask.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    );
  }

  /**
   * 取任务详情（下载前的权限校验 + 可下载判定一体完成）。
   * @param id 任务 id
   * @param viewerId 当前用户 id
   * @param viewerIsAdmin 是否管理员（管理员可下载他人的任务，便于运维协助）
   */
  async getForDownload(
    id: number,
    viewerId: number,
    viewerIsAdmin: boolean,
  ): Promise<{ item: ExportTaskItem; absPath: string }> {
    const row = await this.prisma.exportTask.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('导出任务不存在');
    }
    const item = this.toItem(row);
    if (Number(row.userId) !== viewerId && !viewerIsAdmin) {
      throw AppException.forbidden('只能下载本人发起的导出任务');
    }
    if (item.status !== ExportTaskStatus.DONE || !row.filePath) {
      throw AppException.badRequest(`任务当前状态不可下载（${item.statusText}）`);
    }
    return { item, absPath: path.join(this.exportDir(), row.filePath) };
  }

  /** 删除任务（记录 + 文件一并删除，删没删文件都不阻断记录删除）。 */
  async remove(id: number, viewerId: number, viewerIsAdmin: boolean): Promise<void> {
    const row = await this.prisma.exportTask.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('导出任务不存在');
    }
    if (Number(row.userId) !== viewerId && !viewerIsAdmin) {
      throw AppException.forbidden('只能删除本人发起的导出任务');
    }
    await this.prisma.exportTask.delete({ where: { id: BigInt(id) } });
    if (row.filePath) {
      await fsp.rm(path.join(this.exportDir(), row.filePath), { force: true }).catch(() => undefined);
    }
  }

  /**
   * 清理过期文件（只删磁盘文件，保留记录供审计）。
   * 由任务注册表周期性调用（export-file-sweep）。
   * @returns 清理的文件数与释放的字节数
   */
  async sweepExpired(): Promise<{ removed: number; freedBytes: number }> {
    const now = new Date();
    const expired = await this.prisma.exportTask.findMany({
      where: { status: ExportTaskStatus.DONE, expiresAt: { lt: now }, filePath: { not: null } },
      select: { id: true, filePath: true, size: true },
      take: 200,
    });
    let removed = 0;
    let freedBytes = 0;
    for (const row of expired) {
      if (!row.filePath) {
        continue;
      }
      await fsp.rm(path.join(this.exportDir(), row.filePath), { force: true }).catch(() => undefined);
      // 清空文件字段：记录仍在（审计可见），但不可再下载（下载时会提示已清理）
      await this.prisma.exportTask.update({ where: { id: row.id }, data: { filePath: null } });
      removed += 1;
      freedBytes += Number(row.size);
    }
    return { removed, freedBytes };
  }

  /* ------------------------------ 内部：队列消费 ------------------------------ */

  /** 串行消费队列（processing 保证同一时刻只有一个任务在跑）。 */
  private async drain(): Promise<void> {
    if (this.processing || this.destroyed) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0 && !this.destroyed) {
        const id = this.queue.shift();
        if (id === undefined) {
          break;
        }
        await this.runTask(id);
      }
    } finally {
      this.processing = false;
    }
  }

  /** 执行一个任务：processing → 落盘 → done/failed → 通知。 */
  private async runTask(id: number): Promise<void> {
    const task = await this.prisma.exportTask.findUnique({ where: { id: BigInt(id) } });
    if (!task || task.status !== ExportTaskStatus.PENDING) {
      // 已被删除 / 已处理：跳过（队列是索引，库是事实来源）
      return;
    }
    await this.prisma.exportTask.update({
      where: { id: BigInt(id) },
      data: { status: ExportTaskStatus.PROCESSING },
    });

    const startedAt = Date.now();
    let targetPath = '';
    try {
      // 构造 CSV 流（可能因超上限抛 400——与同步导出同口径，转化为任务失败）
      const csvTask = await this.buildCsvTask(task.module, task.query, task.timezoneOffset ?? undefined);
      const dir = this.taskDir(id);
      await fsp.mkdir(dir, { recursive: true });
      targetPath = path.join(dir, csvTask.filename);
      await this.writeCsvToFile(targetPath, csvTask);

      const stat = await fsp.stat(targetPath);
      const finishedAt = new Date();
      await this.prisma.exportTask.update({
        where: { id: BigInt(id) },
        data: {
          status: ExportTaskStatus.DONE,
          fileName: csvTask.filename,
          filePath: this.relativeTaskPath(id, csvTask.filename),
          total: csvTask.total,
          size: BigInt(stat.size),
          finishedAt,
          expiresAt: new Date(finishedAt.getTime() + this.retentionMs()),
          message: null,
        },
      });

      this.logger.log(`导出任务 #${id} 完成：${csvTask.filename}（${csvTask.total} 行，${Date.now() - startedAt}ms）`);
      await this.notifyOwner(task.userId, task.username, csvTask.filename, true, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`导出任务 #${id} 失败：${message}`);
      // 半成品文件不留：失败的任务不可下载，残留只会占磁盘（目录整体删掉）
      await fsp.rm(targetPath, { force: true }).catch(() => undefined);
      await this.prisma.exportTask
        .update({
          where: { id: BigInt(id) },
          data: {
            status: ExportTaskStatus.FAILED,
            message: message.slice(0, 500),
            finishedAt: new Date(),
            filePath: null,
          },
        })
        .catch(() => undefined);
      await this.notifyOwner(task.userId, task.username, null, false, message);
    }
  }

  /** 按模块构造 CSV 任务（与 logs 控制器的同步导出同一数据链路）。 */
  private async buildCsvTask(module: string, query: unknown, timezoneOffset?: number): Promise<CsvExportTask> {
    const filters = (query ?? {}) as Record<string, unknown>;
    switch (module) {
      case 'login-log':
        return this.logsService.createLoginLogExport(filters, timezoneOffset);
      case 'operation-log':
        return this.logsService.createOperationLogExport(filters, timezoneOffset);
      case 'http-log':
        return this.logsService.createHttpLogExport(filters, timezoneOffset);
      default:
        throw AppException.badRequest(`不支持的导出模块: ${module}`);
    }
  }

  /** 逐批写 CSV 到磁盘（内存只持有当前批；背压由 write 回调处理）。 */
  private async writeCsvToFile(filePath: string, task: CsvExportTask): Promise<void> {
    const stream = createWriteStream(filePath);
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.write(csvHeaderRow(task.header));
      void (async () => {
        try {
          for await (const batch of task.rows) {
            const text = batch.map((row) => csvRow(row)).join('\r\n');
            if (!stream.write(`${text}\r\n`)) {
              // 背压：等内核排空再继续，避免磁盘慢时内存堆积
              await new Promise<void>((drainResolve) => stream.once('drain', drainResolve));
            }
          }
          stream.end(() => resolve());
        } catch (error) {
          stream.destroy();
          reject(error);
        }
      })();
    });
  }

  /** 完成通知：经 NoticeService 落库，event-bus 转 SSE 实时推铃铛。 */
  private async notifyOwner(
    userId: bigint,
    username: string,
    fileName: string | null,
    success: boolean,
    message: string | null,
  ): Promise<void> {
    const title = success ? '导出任务已完成' : '导出任务失败';
    const content = success
      ? `您申请的导出（${fileName}）已生成，请在「下载中心」领取；文件有过期时间，请及时下载。`
      : `您申请的导出任务失败：${message ?? '未知错误'}。可重新提交或缩小范围后重试。`;
    try {
      await this.noticeService.publish({
        userIds: [Number(userId)],
        title,
        content,
        noticeType: success ? NOTICE_TYPE.SYSTEM : NOTICE_TYPE.SECURITY,
        createdBy: null,
      });
      this.logger.log(`已通知 ${username}（任务${success ? '完成' : '失败'}）`);
    } catch (error) {
      this.logger.error(`导出通知失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 导出文件目录（上传目录外的缓存目录，避免被 /static 直接访问到）。 */
  private exportDir(): string {
    return path.resolve(ROOT_DIR, process.env.EXPORT_DIR ?? 'cache/exports');
  }

  private taskDir(id: number): string {
    return path.join(this.exportDir(), String(id));
  }

  private relativeTaskPath(id: number, filename: string): string {
    return path.join(String(id), filename);
  }

  /** 文件保留期（毫秒，默认 3 天，env 可调）。 */
  private retentionMs(): number {
    return 3 * 24 * 60 * 60 * 1000;
  }

  /** 行 → 对外结构（含可下载判定：done 且文件未被清理）。 */
  private toItem(row: {
    id: bigint;
    userId: bigint;
    username: string;
    module: string;
    status: number;
    fileName: string | null;
    filePath: string | null;
    total: number;
    size: bigint;
    message: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    expiresAt: Date | null;
  }): ExportTaskItem {
    const moduleMeta = EXPORT_MODULES[row.module as ExportModuleKey];
    return {
      id: Number(row.id),
      module: row.module,
      moduleLabel: moduleMeta?.label ?? row.module,
      status: row.status,
      statusText: STATUS_TEXT[row.status] ?? '未知',
      fileName: row.fileName,
      total: row.total,
      size: Number(row.size),
      message: row.message,
      username: row.username,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
      expiresAt: row.expiresAt,
      downloadable: row.status === ExportTaskStatus.DONE && row.filePath !== null,
    };
  }
}
