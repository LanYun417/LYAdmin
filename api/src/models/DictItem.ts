/**
 * 字典项模型 `sys_dict_item`。
 * 模块职责：映射字典项（某类型下的一个选项）字段，并关联所属字典类型。
 *
 * 关联说明：通过 `dict_type` 字符串关联 `sys_dict_type.dict_type`（该列唯一），
 * 由数据库外键保证引用完整性；删除类型时级联删除其下所有字典项。
 */
import { AutoIncrement, BelongsTo, Column, DataType, ForeignKey, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { DictType } from './DictType';

@Table({
  tableName: 'sys_dict_item',
  underscored: true,
  timestamps: true,
  comment: '字典项表',
})
export class DictItem extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @ForeignKey(() => DictType)
  @Column({ type: DataType.STRING(100), allowNull: false, comment: '所属字典类型编码' })
  declare dictType: string;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: '字典标签（展示文案）' })
  declare dictLabel: string;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: '字典值（业务存储值）' })
  declare dictValue: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, comment: '排序（升序）' })
  declare sort: number;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '备注' })
  declare remark: string | null;

  /** 所属字典类型（关联属性，命名避免与 `dictType` 列冲突）。 */
  @BelongsTo(() => DictType, {
    foreignKey: 'dictType',
    targetKey: 'dictType',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare dictTypeInfo: DictType;
}
