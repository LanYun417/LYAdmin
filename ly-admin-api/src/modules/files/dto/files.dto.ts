/**
 * 文件模块入参 DTO（class-validator）。
 * 模块职责：路径 id、秒传预检哈希、上传业务归属的校验、分片上传三件套。
 * hash 为必填：缺失 / 空串同样返回 400「hash 非法」，故不做 @IsOptional 放行。
 */
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, Max } from 'class-validator';
import { config } from '../../../common/config/config.js';

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

/** 上传标识（客户端采样哈希，作为分片暂存目录名）：限长 + 安全字符集，防目录穿越。 */
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

/**
 * 分片上传（单片）。
 * 字段走 multipart 表单：文件字段名固定 `file`，其余字段与 DTO 同名。
 */
export class ChunkUploadDto {
  /** 上传标识：同一文件的各分片必须一致（建议用文件内容的采样哈希） */
  @IsString({ message: '上传标识非法' })
  @Matches(IDENTIFIER_PATTERN, { message: '上传标识非法：应为 16-128 位字母/数字/下划线/连字符' })
  identifier!: string;

  /** 分片序号（从 0 开始） */
  @Type(() => Number)
  @IsInt({ message: '分片序号必须为整数' })
  @Min(0, { message: '分片序号不能为负' })
  @Max(9999, { message: '分片序号超出上限' })
  chunkIndex!: number;

  /** 分片总数（1-10000） */
  @Type(() => Number)
  @IsInt({ message: '分片总数必须为整数' })
  @Min(1, { message: '分片总数至少为 1' })
  @Max(10000, { message: '分片总数超出上限' })
  totalChunks!: number;

  /** 原始文件名（决定落盘扩展名分组与对外名称，按扩展名白名单校验） */
  @Transform(trimNullable)
  @IsString({ message: '文件名必须为字符串' })
  @MaxLength(255, { message: '文件名最长 255 个字符' })
  filename!: string;

  /** 文件总大小（字节）：合并时逐字节核对，防止缺片/错片 */
  @Type(() => Number)
  @IsInt({ message: '文件大小必须为整数' })
  @Min(1, { message: '文件大小必须为正' })
  @Max(config.upload.chunkMaxTotalSize, { message: '文件大小超出分片上传上限' })
  totalSize!: number;
}

/** 分片状态查询（断点续传：告诉客户端哪些序号已收）。 */
export class ChunkStatusQueryDto {
  @IsString({ message: '上传标识非法' })
  @Matches(IDENTIFIER_PATTERN, { message: '上传标识非法：应为 16-128 位字母/数字/下划线/连字符' })
  identifier!: string;
}

/** 合并分片：拼合 → 核对大小 → 流式哈希 → 秒传去重 → 落库。 */
export class MergeChunkDto {
  @IsString({ message: '上传标识非法' })
  @Matches(IDENTIFIER_PATTERN, { message: '上传标识非法：应为 16-128 位字母/数字/下划线/连字符' })
  identifier!: string;

  @Type(() => Number)
  @IsInt({ message: '分片总数必须为整数' })
  @Min(1, { message: '分片总数至少为 1' })
  @Max(10000, { message: '分片总数超出上限' })
  totalChunks!: number;

  @Transform(trimNullable)
  @IsString({ message: '文件名必须为字符串' })
  @MaxLength(255, { message: '文件名最长 255 个字符' })
  filename!: string;

  @Type(() => Number)
  @IsInt({ message: '文件大小必须为整数' })
  @Min(1, { message: '文件大小必须为正' })
  @Max(config.upload.chunkMaxTotalSize, { message: '文件大小超出分片上传上限' })
  totalSize!: number;

  /** 文件 MIME（决定白名单校验；浏览器 `file.type`，为空串时按不允许处理，与直传同口径） */
  @IsOptional()
  @Transform(trimNullable)
  @IsString({ message: 'MIME 类型必须为字符串' })
  mimeType?: string;

  /** 业务类型：同直传的 UploadBizDto */
  @IsOptional()
  @Transform(trimNullable)
  @IsString({ message: '业务类型必须为字符串' })
  @MaxLength(50, { message: '业务类型最长 50 个字符' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '业务类型只允许字母、数字、下划线与连字符' })
  bizType?: string;

  /** 业务主键 */
  @IsOptional()
  @Transform(trimNullable)
  @Type(() => Number)
  @IsInt({ message: '业务主键必须为整数' })
  @Min(1, { message: '业务主键必须为正整数' })
  bizId?: number;
}
