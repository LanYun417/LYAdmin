/**
 * 仪表盘 DTO。
 * 模块职责：校验仪表盘查询入参（趋势类接口共用一个 days 可选参数）。
 */
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 趋势查询：限制天数范围 1~30，缺省由服务回退到 7。四个趋势接口共用。 */
export class TrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days 必须为整数' })
  @Min(1, { message: 'days 最小为 1' })
  @Max(30, { message: 'days 最大为 30' })
  days?: number;
}

/** 旧名兼容别名（登录趋势），保持外部引用不破坏。 */
export { TrendQueryDto as LoginTrendQueryDto };
