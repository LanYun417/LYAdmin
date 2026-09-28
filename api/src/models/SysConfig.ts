/**
 * 系统参数模型 `sys_config`。
 * 模块职责：映射系统参数表字段（键值对 + 内置标记），供运行时读取可调参数。
 *
 * 说明：`configKey` 是业务引用键（创建后不可修改），与字典类型的编码同一思路；
 * `systemFlag=1` 的内置参数禁止删除，防止误删导致依赖它的功能退化为默认行为。
 */
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'sys_config',
  underscored: true,
  timestamps: true,
  comment: '系统参数表',
})
export class SysConfig extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: '参数名称（展示用）' })
  declare configName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true,
    comment: '参数键名（业务引用键，创建后不可修改）',
  })
  declare configKey: string;

  @Column({ type: DataType.STRING(500), allowNull: false, defaultValue: '', comment: '参数键值' })
  declare configValue: string;

  @Column({ type: DataType.TINYINT, allowNull: false, defaultValue: 0, comment: '是否内置：1 内置 / 0 自定义' })
  declare systemFlag: number;

  @Column({ type: DataType.STRING(255), allowNull: true, comment: '备注' })
  declare remark: string | null;
}
