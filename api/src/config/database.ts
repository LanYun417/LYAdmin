/**
 * Sequelize 数据库实例。
 * 模块职责：创建单例 Sequelize 实例、注册全部模型与关联、提供连接与建表能力。
 */
import { Sequelize } from 'sequelize-typescript';
import { config } from '@/config';
import { models } from '@/models';

/** 全局唯一 Sequelize 实例。 */
export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  logging: config.db.logging ? (sql: string) => console.log(`[SQL] ${sql}`) : false,
  models,
  define: {
    underscored: true,
    timestamps: true,
    freezeTableName: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    dateStrings: true,
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
