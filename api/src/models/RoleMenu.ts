/**
 * 角色菜单关联模型 `sys_role_menu`。
 * 模块职责：多对多中间表，唯一约束防重复。
 */
import { AutoIncrement, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { Menu } from './Menu';
import { Role } from './Role';

@Table({
  tableName: 'sys_role_menu',
  underscored: true,
  timestamps: false,
  comment: '角色菜单关联表',
  indexes: [{ unique: true, fields: ['role_id', 'menu_id'] }],
})
export class RoleMenu extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @ForeignKey(() => Role)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '角色 id' })
  declare roleId: number;

  @ForeignKey(() => Menu)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '菜单 id' })
  declare menuId: number;
}
