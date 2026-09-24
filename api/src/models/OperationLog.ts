/**
 * 操作日志模型 `sys_operation_log`。
 * 模块职责：记录写操作的模块/动作/参数/耗时/结果。
 */
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'sys_operation_log',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  comment: '操作日志表',
  // 保留期清理（分批 DELETE WHERE created_at < ?）与按时间检索均依赖该索引：
  // 无索引时每批删除都会全表扫描（O(n×批数)）且扫描行会被 InnoDB 加锁更久。
  // 新环境与既有库均由 sequelize.sync 自动建立/补建（已实测：DROP 后重启即自动补回）。
  // 若因权限等原因未能自动建立，可手动 ALTER TABLE sys_operation_log ADD INDEX idx_created_at (created_at)。
  indexes: [{ name: 'idx_created_at', fields: ['created_at'] }],
})
export class OperationLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: true, comment: '操作人 id' })
  declare userId: number | null;

  @Column({ type: DataType.STRING(50), allowNull: true, comment: '操作人账号' })
  declare username: string | null;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '模块' })
  declare module: string;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '动作' })
  declare action: string;

  @Column({ type: DataType.STRING(10), allowNull: false, comment: 'HTTP 方法' })
  declare method: string;

  @Column({ type: DataType.STRING(255), allowNull: false, comment: '请求 URL' })
  declare url: string;

  @Column({ type: DataType.TEXT, allowNull: true, comment: '请求参数（密码脱敏）' })
  declare params: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, comment: '耗时 ms' })
  declare duration: number;

  @Column({ type: DataType.TINYINT, allowNull: false, comment: '1 成功 / 0 失败' })
  declare result: number;

  @Column({ type: DataType.STRING(500), allowNull: true, comment: '失败信息' })
  declare errorMessage: string | null;

  @Column({ type: DataType.STRING(50), allowNull: true, comment: '客户端 IP' })
  declare ip: string | null;

  /** 创建时间（created_at，自动维护） */
  declare createdAt: Date;
}
