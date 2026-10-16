/**
 * 文件模块入参 DTO（class-validator）。
 * 模块职责：路径 id 与秒传预检哈希的校验。
 * 迁移自原 Express 版 file.controller.assertValidHash，字段规则 1:1：
 * 原版对缺失/空串 hash 同样返回 400「hash 非法」，故此处不做 @IsOptional 放行。
 */
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';

/** 路径 id 参数（正整数）。 */
export class IdParamDto {
  @Type(() => Number)
  @IsInt({ message: 'id 必须为正整数' })
  @Min(1, { message: 'id 必须为正整数' })
  id!: number;
}

/** 秒传预检查询（hash 为 SHA-256 十六进制 64 位，必填）。 */
export class CheckQueryDto {
  @IsString({ message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  hash!: string;
}
