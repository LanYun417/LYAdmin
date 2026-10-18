/**
 * 批量操作请求体的通用校验。
 * 模块职责：`{ ids: number[] }` 形式的批量删除 / 批量操作统一经 DTO 校验，避免空数组
 * 触发全表操作、超大数组打爆 SQL，以及字符串 id 混入后拼出非法查询条件。
 */
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

/** 批量操作单次上限：与前端多选翻页策略保持一致，防止一次提交过万条。 */
export const BATCH_IDS_MAX = 500;

/** 批量 id 请求体。 */
export class IdsBodyDto {
  @IsArray({ message: 'ids 必须为数组' })
  @ArrayNotEmpty({ message: '请至少选择一条记录' })
  @ArrayMaxSize(BATCH_IDS_MAX, { message: `单次最多操作 ${BATCH_IDS_MAX} 条记录` })
  @Type(() => Number)
  @IsInt({ each: true, message: 'id 必须为正整数' })
  @Min(1, { each: true, message: 'id 必须为正整数' })
  ids!: number[];
}
