/**
 * 用户模型 `sys_user`。
 * 模块职责：映射用户表字段与角色关联，隐藏密码等敏感字段。
 */
import {
  AutoIncrement,
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Role } from './Role';
import { UserRole } from './UserRole';

@Table({
  tableName: 'sys_user',
  underscored: true,
  timestamps: true,
  comment: '用户表',
})
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true, comment: '登录账号' })
  declare username: string;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: 'bcrypt 哈希' })
  declare password: string;

  @Column({ type: DataType.STRING(50), allowNull: false, defaultValue: '', comment: '昵称' })
  declare nickname: string;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '头像 URL' })
  declare avatar: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, comment: '邮箱' })
  declare email: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true, comment: '手机号' })
  declare phone: string | null;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_login_at',
    comment: '最后登录时间',
  })
  declare lastLoginAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'password_changed_at',
    comment: '密码最后修改时间',
  })
  declare passwordChangedAt: Date | null;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '备注' })
  declare remark: string | null;

  @BelongsToMany(() => Role, () => UserRole)
  declare roles: Role[];

  @HasMany(() => UserRole)
  declare userRoles: UserRole[];

  /** 剔除敏感字段后的 JSON（password / passwordChangedAt 不外泄）。 */
  toJSON(): object {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values.password;
    delete values.passwordChangedAt;
    return values;
  }
}
