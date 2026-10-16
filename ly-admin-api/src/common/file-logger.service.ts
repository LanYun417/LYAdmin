/**
 * 文件日志服务。
 * 模块职责：按天分文件写入 JSON Lines 日志，提供定时归档与保留期清理。
 * 迁移自原 Express 版本的 logging/ 子系统（logManager / archiver / retention / scheduler）。
 *
 * 目录结构：
 * - <logDir>/app-YYYY-MM-DD.log      应用日志
 * - <logDir>/error-YYYY-MM-DD.log    错误日志
 * - <logDir>/access-YYYY-MM-DD.log   HTTP 访问日志
 * - <logDir>/db-YYYY-MM-DD.log       慢 SQL 日志
 * - <logDir>/archive/YYYY-MM-DD/     归档后的历史日志
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { createReadStream, promises as fsp } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import dayjs from 'dayjs';
import { config } from './config.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 日志类型。 */
export type LogKind = 'app' | 'error' | 'access' | 'db';

@Injectable()
export class FileLoggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileLoggerService.name);
  private readonly streams = new Map<string, WriteStream>();
  private archiveTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.ensureDirs();
    this.startArchiveScheduler();
    this.startRetentionScheduler();
  }

  onModuleDestroy(): void {
    if (this.archiveTimer) {
      clearInterval(this.archiveTimer);
    }
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
    }
    this.streams.forEach((stream) => stream.end());
    this.streams.clear();
  }

  /** 确保日志目录存在。 */
  private ensureDirs(): void {
    for (const dir of [config.log.dir, config.log.archiveDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /** 取某类日志当天的文件路径。 */
  private filePath(kind: LogKind, date?: Date): string {
    const day = dayjs(date).format('YYYY-MM-DD');
    return path.join(config.log.dir, `${kind}-${day}.log`);
  }

  /** 懒加载写入流（按 类型+日期 缓存）。 */
  private getStream(kind: LogKind): WriteStream {
    const filePath = this.filePath(kind);
    let stream = this.streams.get(filePath);
    if (!stream) {
      stream = createWriteStream(filePath, { flags: 'a' });
      stream.on('error', (err: unknown) => {
        this.logger.error(`[FileLogger] 写入 ${filePath} 失败: ${err instanceof Error ? err.message : String(err)}`);
      });
      this.streams.set(filePath, stream);
    }
    return stream;
  }

  /** 写入一条 JSON Lines 日志。 */
  write(kind: LogKind, payload: Record<string, unknown>): void {
    try {
      this.ensureDirs();
      const line = `${JSON.stringify({ time: new Date().toISOString(), ...payload })}\n`;
      this.getStream(kind).write(line);
    } catch (error) {
      this.logger.error(`[FileLogger] 写日志失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 写应用日志。 */
  info(message: string, meta?: Record<string, unknown>): void {
    this.write('app', { level: 'info', message, ...meta });
  }

  /** 写错误日志。 */
  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', { level: 'error', message, ...meta });
  }

  /** 写 HTTP 访问日志。 */
  access(meta: Record<string, unknown>): void {
    this.write('access', meta);
  }

  /** 记录慢 SQL。 */
  slowSql(sql: string, durationMs: number): void {
    this.write('db', { sql: sql.slice(0, 4000), duration: durationMs, threshold: config.log.slowSqlMs });
  }

  /* --------------------------- 归档调度 --------------------------- */

  /** 启动每日归档调度（启动补跑 + 定时）。 */
  private startArchiveScheduler(): void {
    const run = (): void => {
      void this.archiveYesterday().catch((err: unknown) => {
        this.logger.error(`[FileLogger] 归档失败: ${err instanceof Error ? err.message : String(err)}`);
      });
    };
    // 启动补跑：仅在已过归档时刻时执行，避免刚启动就重复归档
    const now = new Date();
    const pastArchiveTime =
      now.getHours() > config.log.archiveHour ||
      (now.getHours() === config.log.archiveHour && now.getMinutes() >= config.log.archiveMinute);
    if (pastArchiveTime) {
      run();
    }
    // 每 30 分钟检查一次是否到达归档时刻
    this.archiveTimer = setInterval(run, 30 * 60 * 1000);
  }

  /**
   * 归档昨日日志：把昨日各类型 .log 用 tar 打包到 archive/日期/ 下，
   * 默认归档后删除源文件（LOG_ARCHIVE_KEEP_SOURCE=true 时保留）。
   */
  async archiveYesterday(): Promise<void> {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const archiveDir = path.join(config.log.archiveDir, yesterday);
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    const kinds: LogKind[] = ['app', 'error', 'access', 'db'];
    const targets: string[] = [];
    for (const kind of kinds) {
      const filePath = path.join(config.log.dir, `${kind}-${yesterday}.log`);
      if (existsSync(filePath)) {
        targets.push(filePath);
      }
    }
    if (targets.length === 0) {
      return;
    }

    const tarPath = path.join(archiveDir, `${yesterday}.tar.gz`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.log.tarBin, [
        '-czf',
        tarPath,
        '-C',
        config.log.dir,
        ...targets.map((t) => path.basename(t)),
      ]);
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar 退出码 ${code}: ${stderr}`));
        }
      });
      child.on('error', reject);
    });

    if (!config.log.keepSourceAfterArchive) {
      for (const target of targets) {
        await fsp.unlink(target).catch(() => undefined);
      }
      this.info('日志归档完成', { date: yesterday, archive: tarPath });
    }
  }

  /* --------------------------- 保留清理调度 --------------------------- */

  /** 启动每日保留清理调度（启动补跑 + 定时）。 */
  private startRetentionScheduler(): void {
    if (!config.log.retentionEnabled) {
      this.logger.warn('[LogRetention] 日志保留清理已禁用');
      return;
    }

    const run = (): void => {
      void this.cleanExpiredLogs().catch((err: unknown) => {
        this.logger.error(`[LogRetention] 清理失败: ${err instanceof Error ? err.message : String(err)}`);
      });
    };

    const now = new Date();
    const pastRetentionTime =
      now.getHours() > config.log.retentionHour ||
      (now.getHours() === config.log.retentionHour && now.getMinutes() >= config.log.retentionMinute);
    if (pastRetentionTime) {
      run();
    }
    this.retentionTimer = setInterval(run, 30 * 60 * 1000);
  }

  /**
   * 按保留天数分批 DELETE 清理过期数据库日志。
   *
   * 分批是为避免单条大 DELETE 长时间锁表（InnoDB 会锁住扫描到的行）。
   */
  async cleanExpiredLogs(): Promise<void> {
    if (!config.log.retentionEnabled) {
      return;
    }
    const BATCH = 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    // HTTP 访问日志
    const httpCutoff = new Date(Date.now() - config.log.httpLogRetentionDays * dayMs);
    for (;;) {
      const rows = await this.prisma.httpLog.findMany({
        where: { time: { lt: httpCutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (rows.length === 0) {
        break;
      }
      await this.prisma.httpLog.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      if (rows.length < BATCH) {
        break;
      }
    }

    // 操作日志
    const opCutoff = new Date(Date.now() - config.log.operationLogRetentionDays * dayMs);
    for (;;) {
      const rows = await this.prisma.operationLog.findMany({
        where: { createdAt: { lt: opCutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (rows.length === 0) {
        break;
      }
      await this.prisma.operationLog.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      if (rows.length < BATCH) {
        break;
      }
    }

    // 登录日志
    const loginCutoff = new Date(Date.now() - config.log.loginLogRetentionDays * dayMs);
    for (;;) {
      const rows = await this.prisma.loginLog.findMany({
        where: { loginAt: { lt: loginCutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (rows.length === 0) {
        break;
      }
      await this.prisma.loginLog.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      if (rows.length < BATCH) {
        break;
      }
    }

    this.info('日志保留清理完成', {
      httpDays: config.log.httpLogRetentionDays,
      operationDays: config.log.operationLogRetentionDays,
      loginDays: config.log.loginLogRetentionDays,
    });
  }

  /** 读取指定日志文件内容（供调试/导出使用）。 */
  async readLogFile(kind: LogKind, date: Date): Promise<string> {
    const filePath = this.filePath(kind, date);
    if (!existsSync(filePath)) {
      return '';
    }
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(filePath);
      stream.on('data', (chunk: string | Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }
}
