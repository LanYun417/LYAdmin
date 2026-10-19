/**
 * 站内通知服务。
 * 模块职责：发布通知（指定人或全员）、个人收件箱查询、未读数、已读与删除。
 *
 * 设计要点：
 * - **按人存一条**：支持未读数、逐条已读，以及"只发给某人"的场景（强制下线、改密提醒）；
 * - **通知写入失败绝不影响主流程**：`publish()` 内部吞异常——通知是附加信息，
 *   不能因为通知表写不进去就让"强制下线"这种关键操作失败；
 * - 正文按**纯文本**存储与渲染（不接受 HTML），避免存储型 XSS；
 * - 列表按「未读优先 + 时间倒序」，并支持按类型过滤。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';

/** 通知类型。 */
export const NOTICE_TYPE = {
  /** 系统通知（系统自动产生，如强制下线提醒） */
  SYSTEM: 1,
  /** 公告（管理员手动发布） */
  ANNOUNCEMENT: 2,
  /** 安全提醒（密码重置、异常登录等） */
  SECURITY: 3,
} as const;

export type NoticeType = (typeof NOTICE_TYPE)[keyof typeof NOTICE_TYPE];

/** 通知对外结构。 */
export interface NoticeItem {
  id: number;
  title: string;
  content: string;
  noticeType: number;
  link: string | null;
  isRead: number;
  readAt: string | null;
  createdAt: string;
}

/** 发布通知入参。 */
export interface PublishNoticeInput {
  title: string;
  content: string;
  noticeType: NoticeType;
  link?: string;
  /** 接收人 id 列表；为空表示发给全部启用中的用户 */
  userIds?: number[];
  createdBy: number | null;
}

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发布通知。
   *
   * 全程吞异常：调用方（强制下线、改密、公告发布）不应因为通知写入失败而回滚主操作。
   *
   * @returns 实际写入条数（失败时返回 0）
   */
  async publish(input: PublishNoticeInput): Promise<number> {
    try {
      const targets =
        input.userIds && input.userIds.length > 0
          ? input.userIds
          : (
              await this.prisma.user.findMany({
                where: { status: 1 },
                select: { id: true },
              })
            ).map((user) => Number(user.id));

      if (targets.length === 0) {
        return 0;
      }
      const result = await this.prisma.notice.createMany({
        data: targets.map((userId) => ({
          userId: BigInt(userId),
          title: input.title,
          content: input.content,
          noticeType: input.noticeType,
          link: input.link ?? null,
          createdBy: input.createdBy === null ? null : BigInt(input.createdBy),
        })),
      });
      return result.count;
    } catch (error) {
      this.logger.error(`[Notice] 发布通知失败: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * 个人收件箱（未读优先 + 时间倒序）。
   * @param userId 当前用户
   * @param query 分页与过滤参数（isRead / noticeType）
   */
  async listMine(userId: number, query: Record<string, unknown>): Promise<PageResult<NoticeItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Record<string, unknown> = { userId: BigInt(userId) };
    const isRead = readNumber(query.isRead);
    if (isRead === 0 || isRead === 1) {
      where.isRead = isRead;
    }
    const noticeType = readNumber(query.noticeType);
    if (noticeType !== undefined && Number.isInteger(noticeType)) {
      where.noticeType = noticeType;
    }
    const title = readString(query.title);
    if (title) {
      where.title = { contains: title };
    }

    const [rows, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        // 未读在前；同为未读/已读时按时间倒序
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.notice.count({ where }),
    ]);
    return buildPageResult(
      rows.map((row) => this.toItem(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 未读数（顶栏红点）。 */
  async unreadCount(userId: number): Promise<number> {
    return this.prisma.notice.count({ where: { userId: BigInt(userId), isRead: 0 } });
  }

  /**
   * 标记已读。
   * @param id 通知 id
   * @param userId 当前用户（**必须带 userId 条件**：否则可改别人的通知）
   */
  async markRead(id: number, userId: number): Promise<void> {
    const result = await this.prisma.notice.updateMany({
      where: { id: BigInt(id), userId: BigInt(userId), isRead: 0 },
      data: { isRead: 1, readAt: new Date() },
    });
    if (result.count === 0) {
      // 0 行可能是"已读过了"也可能是"不是我的"，统一给 404 不泄露存在性
      throw AppException.notFound('通知不存在或已读');
    }
  }

  /** 全部标记已读，返回本次标记条数。 */
  async markAllRead(userId: number): Promise<number> {
    const result = await this.prisma.notice.updateMany({
      where: { userId: BigInt(userId), isRead: 0 },
      data: { isRead: 1, readAt: new Date() },
    });
    return result.count;
  }

  /** 删除一条自己的通知。 */
  async remove(id: number, userId: number): Promise<void> {
    const result = await this.prisma.notice.deleteMany({ where: { id: BigInt(id), userId: BigInt(userId) } });
    if (result.count === 0) {
      throw AppException.notFound('通知不存在');
    }
  }

  /** 清空我的通知（已读与未读一起删）。 */
  async clearMine(userId: number): Promise<number> {
    const result = await this.prisma.notice.deleteMany({ where: { userId: BigInt(userId) } });
    return result.count;
  }

  /** 数据库行 → 对外结构。 */
  private toItem(row: {
    id: bigint;
    title: string;
    content: string;
    noticeType: number;
    link: string | null;
    isRead: number;
    readAt: Date | null;
    createdAt: Date;
  }): NoticeItem {
    return {
      id: Number(row.id),
      title: row.title,
      content: row.content,
      noticeType: Number(row.noticeType),
      link: row.link,
      isRead: Number(row.isRead),
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
