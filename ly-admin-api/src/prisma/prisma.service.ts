/**
 * PrismaService：PrismaClient 的生命周期封装与全局导出。
 * 模块职责：建立/关闭数据库连接，并暴露 `PrismaService.prisma` 供各业务模块使用。
 *
 * Prisma 7 约定：
 * - 连接串不写在 schema 中，需通过 driver adapter 在构造 PrismaClient 时注入；
 * - 本项目使用 MySQL（经 @prisma/adapter-mariadb 驱动 mysql2 连接池）。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from '../common/config.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** PrismaClient 的实例类型（供业务层泛型引用）。 */
export type PrismaClientType = PrismaClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const { host, port, user, password, name } = config.db;
    // 驱动适配器：把连接参数交给 mysql2 连接池管理
    const adapter = new PrismaMariaDb({
      host,
      port,
      user,
      password,
      database: name,
      // 连接池上限：避免高并发下耗尽 MySQL 连接数（DB_CONNECTION_LIMIT，默认 10）
      connectionLimit: config.db.connectionLimit,
    });
    super({
      adapter,
      // 查询事件用于慢 SQL 日志（FileLoggerService 订阅后按 LOG_SLOW_SQL_MS 过滤）
      log: config.db.logging ? [{ emit: 'event', level: 'query' }] : [],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`数据库已连接: ${config.db.host}:${config.db.port}/${config.db.name}`);
  }

  /**
   * 订阅查询事件（供慢 SQL 日志使用）。
   *
   * 说明：Prisma Client 的 `$on` 事件类型由**生成时的 log 配置**决定，而本项目的 log 选项是
   * 运行期按 `DB_LOGGING` 传入的，生成的类型因此收窄为 `never`。这里用最小可用签名收敛这处断言，
   * 避免调用方各自做类型转换。
   * @param listener 收到 query 事件时的回调
   */
  onQuery(listener: (event: { query: string; duration: number }) => void): void {
    const client = this as unknown as {
      $on: (event: 'query', callback: (event: { query: string; duration: number }) => void) => void;
    };
    client.$on('query', listener);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('数据库连接已关闭');
  }
}

/**
 * Prisma 模块导出常量。
 * 业务层统一以 `PrismaService` 作为注入 token，避免直接依赖具体实现类。
 */
export const PRISMA_MODULE_DEFINITION = {
  provider: PrismaService,
};
