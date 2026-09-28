/**
 * 部门模型 `sys_dept`。
 * 模块职责：映射部门表字段，维护 parent_id 自关联树与用户归属。
 */
import { AutoIncrement, BelongsTo, Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { User } from './User';

@Table({
  tableName: 'sys_dept',
  underscored: true,
  timestamps: true,
  comment: '部门表',
})
export class Dept extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, comment: '父级 id（0 为根）' })
  declare parentId: number;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '部门名称' })
  declare deptName: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, comment: '排序' })
  declare sort: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({ type: DataType.STRING(20), allowNull: true, comment: '部门负责人' })
  declare leader: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true, comment: '联系电话' })
  declare phone: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, comment: '邮箱' })
  declare email: string | null;

  // 显式指定外键并关闭数据库级约束（与 Menu 自关联同一模式）：
  // 不用 @ForeignKey 装饰器建真实外键，避免与「deptId=0 表示未分配」冲突（0 不在 sys_dept 中会被约束拒绝）
  @HasMany(() => User, { foreignKey: 'deptId', constraints: false })
  declare users: User[];

  @BelongsTo(() => Dept, { foreignKey: 'parentId', constraints: false })
  declare parent: Dept;
}
