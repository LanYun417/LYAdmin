/**
 * 字典类型模型 `sys_dict_type`。
 * 模块职责：映射字典类型（= 字典分类 / 分组）字段，并关联该类型下的字典项。
 *
 * 说明：字典项通过 `dict_type` 编码（唯一）关联本表，而非主键 id —— 业务侧取字典
 * 永远是「按编码要选项」，用编码关联可免 join 直查；因此类型编码一经创建不可修改。
 */
import { AutoIncrement, Column, DataType, HasMany, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { DictItem } from './DictItem';

@Table({
  tableName: 'sys_dict_type',
  underscored: true,
  timestamps: true,
  comment: '字典类型表',
})
export class DictType extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: '字典名称（展示用）' })
  declare dictName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true,
    comment: '字典类型编码（业务引用键，创建后不可修改）',
  })
  declare dictType: string;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 1, comment: '1 启用 / 0 禁用' })
  declare status: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '备注' })
  declare remark: string | null;

  @HasMany(() => DictItem, { foreignKey: 'dictType', sourceKey: 'dictType' })
  declare items: DictItem[];
}
