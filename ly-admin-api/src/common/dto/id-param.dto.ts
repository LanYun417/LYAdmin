/**
 * 路径参数 id 的通用校验。
 * 模块职责：所有 `:id` 路径参数统一经 DTO 校验，避免 `Number('abc')` 得到 NaN 后在数据层
 * 抛出未捕获异常（500），同时把 0 / 负数挡在业务层之外。
 */
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** 正整数路径参数。 */
export class IdParamDto {
  @Type(() => Number)
  @IsInt({ message: 'id 必须为正整数' })
  @Min(1, { message: 'id 必须为正整数' })
  id!: number;
}
