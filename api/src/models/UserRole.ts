/**
 * 用户角色关联模型 `sys_user_role`。
 * 模块职责：多对多中间表，唯一约束防重复。
 */
import { AutoIncrement, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { Role } from './Role';
import { User } from './User';

@Table({
  tableName: 'sys_user_role',
  underscored: true,
  timestamps: false,
  comment: '用户角色关联表',
  indexes: [{ unique: true, fields: ['user_id', 'role_id'] }],
})
export class UserRole extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '用户 id' })
  declare userId: number;

  @ForeignKey(() => Role)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '角色 id' })
  declare roleId: number;
}
