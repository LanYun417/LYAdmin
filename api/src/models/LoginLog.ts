/**
 * 登录日志模型 `sys_login_log`。
 * 模块职责：记录每次登录尝试（成功/失败）。
 */
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'sys_login_log',
  underscored: true,
  timestamps: false,
  comment: '登录日志表',
  // 保留期清理（分批 DELETE WHERE login_at < ?）与按时间检索均依赖该索引：
  // 无索引时每批删除都会全表扫描（O(n×批数)）且扫描行会被 InnoDB 加锁更久。
  // 新环境与既有库均由 sequelize.sync 自动建立/补建（已实测：DROP 后重启即自动补回）。
  // 若因权限等原因未能自动建立，可手动 ALTER TABLE sys_login_log ADD INDEX idx_login_at (login_at)。
  indexes: [{ name: 'idx_login_at', fields: ['login_at'] }],
})
export class LoginLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '登录账号' })
  declare username: string;

  @Column({ type: DataType.STRING(50), allowNull: true, comment: '客户端 IP' })
  declare ip: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true, comment: 'User-Agent' })
  declare userAgent: string | null;

  @Column({ type: DataType.TINYINT, allowNull: false, comment: '1 成功 / 0 失败' })
  declare status: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '结果描述' })
  declare message: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'login_at',
    defaultValue: DataType.NOW,
    comment: '登录时间',
  })
  declare loginAt: Date;
}
