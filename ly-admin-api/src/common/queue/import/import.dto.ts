/**
 * 数据导入 DTO。
 */
import { IsIn, IsNumber, IsOptional, IsString, Length } from 'class-validator';

/** 上传入队参数（type 走 query，见控制器）。 */
export class ImportSubmitDto {
  @IsString()
  @Length(1, 50)
  type!: string;
}

/** 导入记录查询。 */
export class ImportRecordQueryDto {
  @IsOptional()
  @IsString()
  @Length(0, 50)
  type?: string;

  @IsOptional()
  @IsIn(['ok', 'partial', 'failed'])
  status?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
