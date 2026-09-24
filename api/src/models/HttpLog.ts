/**
 * HTTP 访问日志模型 `sys_http_log`。
 * 模块职责：持久化后端 API 请求的访问日志，供日志页面分页/筛选查询。
 * 说明：物理文件（logs/access/）用于留痕，本表用于页面查询；「清空日志」只清本表。
 */
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'sys_http_log',
  underscored: true,
  timestamps: false,
  comment: 'HTTP 访问日志表',
  indexes: [
    { name: 'idx_time', fields: ['time'] },
    { name: 'idx_method', fields: ['method'] },
    { name: 'idx_status_code', fields: ['status_code'] },
    { name: 'idx_method_time', fields: ['method', 'time'] },
  ],
})
export class HttpLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.DATE(3), allowNull: false, comment: '请求完成时间（本地时区 +08:00）' })
  declare time: Date;

  @Column({ type: DataType.STRING(10), allowNull: false, comment: 'HTTP 方法' })
  declare method: string;

  @Column({ type: DataType.STRING(1024), allowNull: false, comment: '请求 URL（含 query）' })
  declare url: string;

  @Column({ type: DataType.SMALLINT.UNSIGNED, allowNull: false, comment: 'HTTP 状态码' })
  declare statusCode: number;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, comment: '耗时 ms' })
  declare duration: number;

  @Column({ type: DataType.STRING(64), allowNull: true, comment: '客户端 IP' })
  declare ip: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true, comment: 'User-Agent' })
  declare userAgent: string | null;

  @Column({ type: DataType.JSON, allowNull: true, comment: '查询参数（已脱敏）' })
  declare query: Record<string, unknown> | null;

  @Column({ type: DataType.TEXT, allowNull: true, comment: '请求体（已脱敏、截断 2KB）' })
  declare reqBody: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, comment: '响应内容（截断 2KB；二进制为占位）' })
  declare resBody: string | null;
}
