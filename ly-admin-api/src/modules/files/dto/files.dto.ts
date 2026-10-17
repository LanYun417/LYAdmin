/**
 * 文件模块入参 DTO（class-validator）。
 * 模块职责：路径 id 与秒传预检哈希的校验。
 * hash 为必填：缺失 / 空串同样返回 400「hash 非法」，故不做 @IsOptional 放行。
 */
import { IsString, Matches } from 'class-validator';

/** 秒传预检查询（hash 为 SHA-256 十六进制 64 位，必填）。 */
export class CheckQueryDto {
  @IsString({ message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  @Matches(/^[a-f0-9]{64}$/i, { message: 'hash 非法，应为 SHA-256 十六进制（64 位）' })
  hash!: string;
}
