/**
 * 在线用户控制器。
 * 模块职责：会话列表查询与强制下线（单个会话 / 某用户全部会话）。
 *
 * 权限码（需在菜单里授权给相应角色）：
 * - `monitor:online:list`       查看在线用户
 * - `monitor:online:forceLogout` 强制下线
 */
import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { MonitorService, type OnlineSessionItem } from './monitor.service.js';

/** 会话 id 参数（UUID v4：由 SessionService 用 randomUUID 生成）。 */
export class SidParamDto {
  @IsString({ message: '会话 id 非法' })
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: '会话 id 非法' })
  sid!: string;
}

/**
 * 用户 id 路径参数。
 * 注意不能复用 `IdParamDto`：它的字段名是 `id`，而本路由的参数名是 `userId`，
 * 复用会让 `params.id` 恒为 undefined 并返回 400（校验"通过 DTO 收口"的好处就是这类错会立刻暴露）。
 */
export class UserIdParamDto {
  @Type(() => Number)
  @IsInt({ message: '用户 id 必须为正整数' })
  @Min(1, { message: '用户 id 必须为正整数' })
  userId!: number;
}

@Controller('monitor/online')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  /** 在线会话列表。 */
  @Get()
  @RequirePermissions('monitor:online:list')
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.monitorService.listOnline(query);
  }

  /** 强制下线单个会话。 */
  @Delete(':sid')
  @RequirePermissions('monitor:online:forceLogout')
  @OperationLog('在线用户', '强制下线')
  async forceLogout(@Param() params: SidParamDto): Promise<ResponseEnvelope<OnlineSessionItem | null>> {
    await this.monitorService.forceLogoutSession(params.sid);
    return { __raw: true, data: null, message: '已强制下线' };
  }

  /** 强制下线某用户的全部会话。 */
  @Delete('user/:userId')
  @RequirePermissions('monitor:online:forceLogout')
  @OperationLog('在线用户', '强制下线全部会话')
  async forceLogoutAll(@Param() params: UserIdParamDto): Promise<ResponseEnvelope<null>> {
    const removed = await this.monitorService.forceLogoutUser(params.userId);
    return { __raw: true, data: null, message: `已下线 ${removed} 个会话` };
  }
}
