/**
 * 通用任务队列 DTO。
 */
import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

/** 任务状态枚举（列表筛选）。 */
const STATUS_VALUES = ['pending', 'running', 'done', 'dead'];

/** 入队参数。 */
export class EnqueueJobDto {
  @IsString()
  @Length(1, 50)
  type!: string;

  @IsString()
  @Length(1, 100)
  title!: string;

  /** 任务负载（处理器按 type 解释） */
  @IsObject()
  payload!: Record<string, unknown>;

  /** 幂等键：同键已在库直接返回已有任务（空 = 不去重） */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idemKey?: string;

  /** 最大尝试次数（含首次，默认 3） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}

/** 任务列表查询。 */
export class QueueJobQueryDto {
  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  type?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
