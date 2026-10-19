/**
 * 站内通知控制器。
 *
 * 权限口径：收件箱相关的接口（列表 / 未读数 / 已读 / 删除）**不设权限码**——
 * 每条通知按 userId 天然隔离，任何登录用户都只能操作自己的收件箱，
 * 这和「字典取数」是同一类"元数据接口"。
 * 只有「发布通知」是管理动作，需要 `system:notice:add`。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { type ResponseEnvelope } from '../../common/http/response.interceptor.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { AppException } from '../../common/exception/app.exception.js';
import type { AuthUserContext } from '../../common/types.js';
import { NOTICE_TYPE, NoticeService, type NoticeItem, type NoticeType } from './notice.service.js';

/** 发布通知入参。 */
export class PublishNoticeDto {
  @IsString({ message: '标题必须为字符串' })
  @MaxLength(200, { message: '标题最长 200 个字符' })
  title!: string;

  @IsString({ message: '正文必须为字符串' })
  @MaxLength(2000, { message: '正文最长 2000 个字符' })
  content!: string;

  @Type(() => Number)
  @IsInt({ message: '通知类型必须为整数' })
  @IsEnum(Object.values(NOTICE_TYPE) as number[], { message: '通知类型非法' })
  noticeType!: NoticeType;

  /** 点击跳转的前端路由（可空） */
  @IsOptional()
  @IsString({ message: '跳转链接必须为字符串' })
  @MaxLength(255, { message: '跳转链接最长 255 个字符' })
  link?: string;

  /** 指定接收人；为空表示发给全部启用中的用户 */
  @IsOptional()
  @IsArray({ message: '接收人必须为数组' })
  @ArrayNotEmpty({ message: '接收人不能为空数组' })
  @ArrayMaxSize(1000, { message: '单次最多发送给 1000 人' })
  @Type(() => Number)
  @IsInt({ each: true, message: '接收人 id 必须为正整数' })
  @Min(1, { each: true, message: '接收人 id 必须为正整数' })
  userIds?: number[];
}

@Controller('notices')
export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  /** 我的收件箱（未读优先 + 时间倒序）。 */
  @Get()
  list(@CurrentUser() user: AuthUserContext, @Query() query: Record<string, unknown>): Promise<unknown> {
    return this.noticeService.listMine(user.userId, query);
  }

  /** 未读数（顶栏红点）。 */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUserContext): Promise<{ count: number }> {
    return { count: await this.noticeService.unreadCount(user.userId) };
  }

  /** 发布通知（指定人或全员）。 */
  @Post()
  @RequirePermissions('system:notice:add')
  @OperationLog('通知中心', '发布通知')
  async publish(
    @Body() dto: PublishNoticeDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<ResponseEnvelope<{ count: number }>> {
    const title = dto.title.trim();
    const content = dto.content.trim();
    if (!title) {
      throw AppException.badRequest('标题不能为空');
    }
    if (!content) {
      throw AppException.badRequest('正文不能为空');
    }
    const count = await this.noticeService.publish({
      title,
      content,
      noticeType: dto.noticeType,
      link: dto.link,
      userIds: dto.userIds,
      createdBy: user.userId,
    });
    return { __raw: true, data: { count }, message: `已发送 ${count} 条` };
  }

  /** 标记已读。 */
  @Put(':id/read')
  @OperationLog('通知中心', '标记已读')
  async markRead(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<ResponseEnvelope<null>> {
    await this.noticeService.markRead(params.id, user.userId);
    return { __raw: true, data: null, message: '已标记为已读' };
  }

  /** 全部标记已读。 */
  @Put('read-all')
  @OperationLog('通知中心', '全部已读')
  async markAllRead(@CurrentUser() user: AuthUserContext): Promise<ResponseEnvelope<{ count: number }>> {
    const count = await this.noticeService.markAllRead(user.userId);
    return { __raw: true, data: { count }, message: `已标记 ${count} 条为已读` };
  }

  /** 删除一条通知。 */
  @Delete(':id')
  @OperationLog('通知中心', '删除通知')
  async remove(@Param() params: IdParamDto, @CurrentUser() user: AuthUserContext): Promise<ResponseEnvelope<null>> {
    await this.noticeService.remove(params.id, user.userId);
    return { __raw: true, data: null, message: '删除成功' };
  }

  /** 清空我的通知。 */
  @Delete()
  @OperationLog('通知中心', '清空通知')
  async clear(@CurrentUser() user: AuthUserContext): Promise<ResponseEnvelope<{ count: number }>> {
    const count = await this.noticeService.clearMine(user.userId);
    return { __raw: true, data: { count }, message: `已清空 ${count} 条` };
  }
}

/** 供其它模块复用的类型导出（避免各处重复 import 类型路径）。 */
export type { NoticeItem };
