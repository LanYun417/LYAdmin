/**
 * 仪表盘 DTO。
 * 模块职责：校验仪表盘查询入参（目前仅登录趋势的 days 可选参数）。
 */
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 登录趋势查询：限制天数范围 1~30，缺省由服务回退到 7。 */
export class LoginTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days 必须为整数' })
  @Min(1, { message: 'days 最小为 1' })
  @Max(30, { message: 'days 最大为 30' })
  days?: number;
}
