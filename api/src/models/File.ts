/**
 * 文件模型 `sys_file`。
 * 模块职责：记录上传文件的元信息与访问 URL。
 */
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  tableName: 'sys_file',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  comment: '文件表',
})
export class File extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '主键' })
  declare id: number;

  @Column({ type: DataType.STRING(255), allowNull: false, comment: '原始文件名' })
  declare originName: string;

  @Column({ type: DataType.STRING(255), allowNull: false, comment: '存储文件名' })
  declare fileName: string;

  @Column({ type: DataType.STRING(500), allowNull: false, comment: '磁盘相对路径' })
  declare filePath: string;

  @Column({ type: DataType.STRING(500), allowNull: false, comment: '访问 URL' })
  declare fileUrl: string;

  @Column({ type: DataType.STRING(100), allowNull: false, comment: 'MIME' })
  declare mimeType: string;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, comment: '字节' })
  declare size: number;

  @Column({ type: DataType.STRING(64), allowNull: true, comment: 'SHA-256 内容哈希（秒传/去重依据）' })
  declare hash: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: true, comment: '上传人 id' })
  declare uploaderId: number | null;

  /** 创建时间（created_at，自动维护） */
  declare createdAt: Date;
}
