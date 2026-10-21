/**
 * 文件日志服务。
 * 模块职责：按天分文件写入 JSON Lines 日志，并提供日志归档与保留期清理能力。
 *
 * 目录结构：
 * - <logDir>/app-YYYY-MM-DD.log      应用日志
 * - <logDir>/error-YYYY-MM-DD.log    错误日志
 * - <logDir>/access-YYYY-MM-DD.log   HTTP 访问日志
 * - <logDir>/db-YYYY-MM-DD.log       慢 SQL 日志
 * - <logDir>/archive/YYYY-MM-DD/     归档后的历史日志
 *
 * ⚠️ 归档与保留清理的**调度**已收编到 TaskModule（见 src/modules/task/），
 * 本服务只负责「怎么做」，不再自带 setInterval 定时器——否则同一件事会有两套调度，
 * 出现重复执行且无法在管理端统一观察。此处保留 archiveYesterday / cleanExpiredLogs 为 public，
 * 供 TaskService 调用。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { createReadStream, promises as fsp } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import dayjs from 'dayjs';
import { config } from '../config/config.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 日志类型。 */
export type LogKind = 'app' | 'error' | 'access' | 'db';

/**
 * 拼 tar 归档参数。
 *
 * 为什么单独抽成纯函数：Windows 上 GNU tar 会把带盘符的绝对路径（C:\...）当成
 * 「主机:路径」解析，直接报 `tar (child): Cannot connect to C: resolve failed`
 * 并以退出码 2 结束——这个坑只有把参数摊开看才发现，必须由测试跨平台钉住
 * （真机打包测试只在 Windows 上能暴露）。Unix 上不加这个 GNU 专属选项（BSD/bsdtar 不认）。
 *
 * @param params 打包目标
 * @param params.tarPath 产物 .tar.gz 路径
 * @param params.workDir 变更目录（对应 -C）
 * @param params.names 要打包的文件名（相对 workDir）
 * @param params.platform 运行平台，默认取 process.platform（测试注入用）
 * @returns tar 命令行参数数组
 */
export function buildArchiveArgs(params: {
  tarPath: string;
  workDir: string;
  names: string[];
  platform?: string;
}): string[] {
  const localFlag = (params.platform ?? process.platform) === 'win32' ? ['--force-local'] : [];
  return [...localFlag, '-czf', params.tarPath, '-C', params.workDir, ...params.names];
}

@Injectable()
export class FileLoggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileLoggerService.name);
  private readonly streams = new Map<string, WriteStream>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.ensureDirs();
    this.subscribeSlowSql();
  }

  /**
   * 订阅 Prisma 查询事件：耗时超过 `LOG_SLOW_SQL_MS` 的写入 `db-YYYY-MM-DD.log`。
   * 仅当 `DB_LOGGING=true` 时 Prisma 才会发出事件（见 PrismaService 的 log 配置）。
   */
  private subscribeSlowSql(): void {
    if (!config.db.logging) {
      return;
    }
    this.prisma.onQuery((event) => {
      if (event.duration >= config.log.slowSqlMs) {
        this.slowSql(event.query, event.duration);
      }
    });
  }

  onModuleDestroy(): void {
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

  /* --------------------------- 归档 --------------------------- */

  /**
   * 归档昨日日志：把昨日各类型 .log 用 tar 打包到 archive/日期/ 下，
   * 默认归档后删除源文件（LOG_ARCHIVE_KEEP_SOURCE=true 时保留）。
   *
   * 由 TaskModule 的「日志归档」任务按 cron 调用，不自带定时器。
   */
  async archiveYesterday(): Promise<void> {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    const kinds: LogKind[] = ['app', 'error', 'access', 'db'];
    const targets: string[] = [];
    for (const kind of kinds) {
      const filePath = path.join(config.log.dir, `${kind}-${yesterday}.log`);
      if (existsSync(filePath)) {
        targets.push(filePath);
      }
    }
    // 空跑直接返回：连日期目录都不建（任务每天执行，建一堆空目录只会污染 logs/archive）
    if (targets.length === 0) {
      return;
    }

    const archiveDir = path.join(config.log.archiveDir, yesterday);
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    const tarPath = path.join(archiveDir, `${yesterday}.tar.gz`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        config.log.tarBin,
        buildArchiveArgs({
          tarPath,
          workDir: config.log.dir,
          names: targets.map((t) => path.basename(t)),
        }),
      );
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
      child.on('error', (error: NodeJS.ErrnoException) => {
        // Windows 开发机常见：PATH 里没有 tar.exe，spawn 直接 ENOENT。
        // 裸抛 "spawn tar ENOENT" 没人知道要装什么、怎么配，故补一句可操作提示。
        if (error.code === 'ENOENT') {
          reject(new Error(`未找到 tar 可执行文件（${config.log.tarBin}），可用环境变量 TAR_BIN 指定绝对路径`));
          return;
        }
        reject(error);
      });
    });

    if (!config.log.keepSourceAfterArchive) {
      for (const target of targets) {
        await fsp.unlink(target).catch(() => undefined);
      }
      this.info('日志归档完成', { date: yesterday, archive: tarPath });
    }
  }

  /* --------------------------- 保留清理 --------------------------- */

  /**
   * 按保留天数分批 DELETE 清理过期数据库日志。
   *
   * 分批是为避免单条大 DELETE 长时间锁表（InnoDB 会锁住扫描到的行）。
   *
   * 由 TaskModule 的「日志保留清理」任务按 cron 调用，不自带定时器。
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
