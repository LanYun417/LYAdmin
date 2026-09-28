/**
 * 角色模型 `sys_role`。
 * 模块职责：映射角色表字段，关联用户与菜单。
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
import { Menu } from './Menu';
import { RoleDept } from './RoleDept';
import { RoleMenu } from './RoleMenu';
import { User } from './User';
import { UserRole } from './UserRole';

@Table({
  tableName: 'sys_role',
  underscored: true,
  timestamps: true,
  comment: '角色表',
})
export class Role extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(50), allowNull: false, comment: '角色名称' })
  declare roleName: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true, comment: '角色编码' })
  declare roleCode: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, comment: '排序' })
  declare sort: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({
    type: DataType.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人',
  })
  declare dataScope: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '备注' })
  declare remark: string | null;

  @BelongsToMany(() => User, () => UserRole)
  declare users: User[];

  @BelongsToMany(() => Menu, () => RoleMenu)
  declare menus: Menu[];

  @HasMany(() => UserRole)
  declare userRoles: UserRole[];

  @HasMany(() => RoleMenu)
  declare roleMenus: RoleMenu[];

  @HasMany(() => RoleDept)
  declare roleDepts: RoleDept[];
}
