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
      // 连接池上限：避免高并发下耗尽 MySQL 连接数
      connectionLimit: 10,
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`数据库已连接: ${config.db.host}:${config.db.port}/${config.db.name}`);
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
