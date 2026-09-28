/**
 * 角色数据权限部门关联模型 `sys_role_dept`。
 * 模块职责：多对多中间表，承载「自定义部门」数据范围（data_scope=2）的部门集合。
 */
import { AutoIncrement, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { Dept } from './Dept';
import { Role } from './Role';

@Table({
  tableName: 'sys_role_dept',
  underscored: true,
  timestamps: false,
  comment: '角色数据权限部门关联表',
  indexes: [{ unique: true, fields: ['role_id', 'dept_id'] }],
})
export class RoleDept extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @ForeignKey(() => Role)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '角色 id' })
  declare roleId: number;

  @ForeignKey(() => Dept)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false, comment: '部门 id' })
  declare deptId: number;
}
