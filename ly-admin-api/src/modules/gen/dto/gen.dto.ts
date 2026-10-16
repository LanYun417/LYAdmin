/**
 * 代码生成接口 DTO。
 * 模块职责：校验前端提交的生成配置（表名 / 模块名 / 业务名 / 字段控件选项）。
 * 校验失败由全局 ValidationPipe 拦截返回 400，无需控制器手动判断。
 */
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** 单字段的控件配置（按 columnName 合并到表结构探测结果）。 */
export class GenColumnOptionDto {
  /** 列名（下划线形式，与表结构探测结果对应） */
  @IsString()
  @IsNotEmpty({ message: '字段名不能为空' })
  columnName!: string;

  /** 控件类型：普通输入框 / 字典下拉 / 树形父级选择 */
  @IsIn(['input', 'select', 'treeSelect'], { message: '控件类型非法' })
  htmlType!: 'input' | 'select' | 'treeSelect';

  /** 绑定的字典类型编码（htmlType=select 时必填，由服务校验） */
  @IsOptional()
  @IsString()
  dictType?: string;
}

/** 代码生成配置。 */
export class GenConfigDto {
  /** 数据库表名（必须真实存在） */
  @IsString()
  @IsNotEmpty({ message: '表名不能为空' })
  tableName!: string;

  /** 模块名（如 system）：字母开头，仅字母数字 */
  @IsString()
  @IsNotEmpty({ message: '模块名不能为空' })
  moduleName!: string;

  /** 业务名（如 user）：字母开头，仅字母数字，会拼进生成物路径 */
  @IsString()
  @IsNotEmpty({ message: '业务名不能为空' })
  businessName!: string;

  /** 作者（写入文件头注释） */
  @IsOptional()
  @IsString()
  author?: string;

  /** 是否树形表：列表返回整棵树、不生成分页 */
  @IsOptional()
  @IsBoolean()
  isTree?: boolean;

  /** 树形表父级字段名（默认 parentId） */
  @IsOptional()
  @IsString()
  treeParentField?: string;

  /** 各字段的控件类型 / 字典绑定（按 columnName 合并） */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenColumnOptionDto)
  columnOptions?: GenColumnOptionDto[];
}

/** 生成并落盘请求：在 GenConfig 基础上增加「是否覆盖已存在文件」标志。 */
export class GenCreateDto extends GenConfigDto {
  /** 同名文件已存在时是否覆盖（默认 false → 409 冲突） */
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
