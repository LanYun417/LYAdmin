/**
 * 文件模块入参 DTO（class-validator）。
 * 模块职责：路径 id、秒传预检哈希、上传业务归属的校验。
 * hash 为必填：缺失 / 空串同样返回 400「hash 非法」，故不做 @IsOptional 放行。
 */
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/** 秒传预检查询（hash 为 SHA-256 十六进制 64 位，必填）。 */
export class CheckQueryDto {
  @IsString({ message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  hash!: string;
}

/** 去空白；空串归一为 undefined（multipart 表单未填的字段会传空串）。 */
const trimNullable = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * 上传时的业务归属（multipart 表单字段，可缺省）。
 * 用途：让附件能按业务反查（如「某公告的全部附件」），而不是只有文件名和上传人。
 */
export class UploadBizDto {
  /** 业务类型：模块标识，只允许字母/数字/下划线/连字符（避免塞入任意文本污染筛选） */
  @IsOptional()
  @Transform(trimNullable)
  @IsString({ message: '业务类型必须为字符串' })
  @MaxLength(50, { message: '业务类型最长 50 个字符' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '业务类型只允许字母、数字、下划线与连字符' })
  bizType?: string;

  /** 业务主键：表单里是字符串，需显式转数字后校验 */
  @IsOptional()
  @Transform(trimNullable)
  @Type(() => Number)
  @IsInt({ message: '业务主键必须为整数' })
  @Min(1, { message: '业务主键必须为正整数' })
  bizId?: number;
}
