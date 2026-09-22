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
