/**
 * 菜单权限模型 `sys_menu`。
 * 模块职责：映射菜单表字段，维护 parent_id 自关联树与角色关联。
 */
import {
  AutoIncrement,
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Role } from './Role';
import { RoleMenu } from './RoleMenu';

@Table({
  tableName: 'sys_menu',
  underscored: true,
  timestamps: true,
  comment: '菜单权限表',
})
export class Menu extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, comment: '父级 id（0 为根）' })
  declare parentId: number;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '菜单名称' })
  declare menuName: string;

  @Column({ type: DataType.CHAR(1), allowNull: false, comment: 'M 目录 / C 菜单 / F 按钮' })
  declare menuType: string;

  @Column({ type: DataType.STRING(200), allowNull: true, comment: '路由路径' })
  declare path: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '组件路径' })
  declare component: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, comment: '图标' })
  declare icon: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, comment: '权限标识' })
  declare permission: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, comment: '排序' })
  declare sort: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 显示 / 0 隐藏' })
  declare visible: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '重定向' })
  declare redirect: string | null;

  @Column({
    type: DataType.TINYINT,
    allowNull: false,
    defaultValue: 0,
    field: 'keep_alive',
    comment: '1 缓存 / 0 不缓存',
  })
  declare keepAlive: number;

  @HasMany(() => Menu, { foreignKey: 'parentId', constraints: false })
  declare children: Menu[];

  @BelongsTo(() => Menu, { foreignKey: 'parentId', constraints: false })
  declare parent: Menu;

  @BelongsToMany(() => Role, () => RoleMenu)
  declare roles: Role[];

  @HasMany(() => RoleMenu)
  declare roleMenus: RoleMenu[];
}
