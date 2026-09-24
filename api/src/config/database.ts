/**
 * Sequelize 数据库实例。
 * 模块职责：创建单例 Sequelize 实例、注册全部模型与关联、提供连接与建表能力。
 */
import { Sequelize } from 'sequelize-typescript';
import { config } from '@/config';
import { writeLog } from '@/logging/logManager';
import type { DbLogRecord } from '@/logging/types';
import { models } from '@/models';

/**
 * 构造 Sequelize SQL 日志钩子：把每条 SQL（含耗时）写入 `logs/db/` 日志文件。
 *
 * 关键约定（见 docs/system_design.md §3.5 / §8）：
 * - **仅写文件、绝不写数据库**，避免 SQL 日志自触发造成递归。
 * - 需配合 `benchmark: true` 才能拿到 `timing`（毫秒）；缺失时按 0 处理。
 * - `slow` = 耗时 >= `config.log.slowSqlMs`（默认 200ms）。
 * - 任何写入异常内部捕获，绝不影响数据库正常行为。
 * @returns Sequelize `logging` 回调
 */
function createDbLogger(): (sql: string, timing?: number) => void {
  return (sql: string, timing?: number): void => {
    try {
      const durationMs = typeof timing === 'number' ? timing : 0;
      const record: DbLogRecord = {
        time: new Date().toISOString(),
        sql,
        durationMs,
        slow: durationMs >= config.log.slowSqlMs,
      };
      writeLog('db', record);
    } catch (error) {
      console.error('[DBLogger] 写入数据库日志失败:', error);
    }
  };
}

/** 全局唯一 Sequelize 实例。 */
export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  // config.db.logging=true 时：SQL 写入 logs/db/ 文件（不再打印到控制台）
  logging: config.db.logging ? createDbLogger() : false,
  // 开启 benchmark 以获取每条 SQL 的耗时（供 db 日志 durationMs / slow 使用）
  benchmark: true,
  models,
  define: {
    underscored: true,
    timestamps: true,
    freezeTableName: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    typeCast: true,
    charset: 'utf8mb4',
  },
  // 以 +08:00 格式化写入/读回 DATETIME，避免 UTC 与本地时区解析错位
  timezone: '+08:00',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

/**
 * 测试数据库连通性。
 * @throws 连接失败时抛出原始异常
 */
export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  console.log('[DB] MySQL 连接成功:', `${config.db.host}:${config.db.port}/${config.db.name}`);
}

/**
 * 同步模型到数据库（自动建表，不修改既有结构）。
 */
export async function syncDatabase(): Promise<void> {
  await sequelize.sync({ alter: false });
  console.log('[DB] 数据表同步完成');
}
