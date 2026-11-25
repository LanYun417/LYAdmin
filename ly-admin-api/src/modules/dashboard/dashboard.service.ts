/**
 * 仪表盘服务。
 * 模块职责：聚合统计卡片、登录趋势、操作分布、角色用户数等数据。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { LogResult } from '../../common/config/constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DashboardStats } from '../../common/types.js';

/** 登录趋势（近 N 日每日登录成功数）。 */
export interface LoginTrend {
  dates: string[];
  counts: number[];
}

/** 操作类型分布（名称 → 数量）。 */
export interface NameValue {
  name: string;
  value: number;
}

/** 各角色用户数（names ↔ counts 一一对应）。 */
export interface RoleUserCount {
  names: string[];
  counts: number[];
}

/** 请求量趋势（近 N 日每日 HTTP 请求总数与错误数）。 */
export interface RequestTrend {
  dates: string[];
  requests: number[];
  errors: number[];
}

/** 活跃用户趋势（近 N 日每日成功登录的去重账号数）。 */
export interface ActiveUserTrend {
  dates: string[];
  counts: number[];
}

/** 天数上限（与 LoginTrend 一致，避免超长区间拖慢聚合）。 */
const MAX_TREND_DAYS = 30;

/** 归一到 1~MAX_TREND_DAYS 的合法天数。 */
function safeDays(days: number): number {
  return Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), MAX_TREND_DAYS) : 7;
}

/** 数据库存 UTC 时刻，按「服务器本地日」分组需加回的分钟偏移。 */
function timezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * 把「按日聚合的行」摊平成前端图表要的连续日期数组（缺勤日补 0）。
 * @param rows 形如 { day: 'YYYY-MM-DD', total: bigint } 的聚合结果
 * @param start 区间起始日（dayjs 对象）
 * @param days 天数
 */
function fillDailyCounts(
  rows: Array<{ day: string; total: bigint }>,
  start: dayjs.Dayjs,
  days: number,
): { dates: string[]; counts: number[] } {
  const byDay = new Map(rows.map((row) => [row.day, Number(row.total)]));
  const dates: string[] = [];
  const counts: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = start.add(i, 'day');
    dates.push(day.format('MM-DD'));
    counts.push(byDay.get(day.format('YYYY-MM-DD')) ?? 0);
  }
  return { dates, counts };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** 统计卡片数据。 */
  async getStats(): Promise<DashboardStats> {
    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const [userTotal, roleTotal, menuTotal, todayLoginCount, httpStats] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.menu.count(),
      this.prisma.loginLog.count({
        where: {
          loginAt: { gte: startOfToday, lte: endOfToday },
          status: LogResult.SUCCESS,
        },
      }),
      // 一条 SQL 同时算今日请求总量与错误数（status >= 400）：
      // 逐条 count 会扫两遍 HTTP 日志表，条件聚合一次扫描即可。
      this.prisma.$queryRaw<Array<{ requests: bigint; errors: bigint | null }>>`
        SELECT COUNT(*) AS requests,
               SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
        FROM sys_http_log
        WHERE time >= ${startOfToday} AND time <= ${endOfToday}
      `,
    ]);

    return {
      userTotal,
      roleTotal,
      menuTotal,
      todayLoginCount,
      todayRequestCount: Number(httpStats[0]?.requests ?? 0),
      todayErrorCount: Number(httpStats[0]?.errors ?? 0),
    };
  }

  /** 近 N 日登录趋势（默认 7，最大 30）。 */
  async getLoginTrend(days = 7): Promise<LoginTrend> {
    const count = safeDays(days);
    const start = dayjs()
      .subtract(count - 1, 'day')
      .startOf('day');
    const end = dayjs().endOf('day');
    const offsetMinutes = timezoneOffsetMinutes();

    // 一条 SQL 完成按日聚合：Prisma 的 groupBy 无法按「日期截断」分组，
    // 逐日 count 会退化为 N 次扫描（默认 7 次、最大 30 次）。
    const rows = await this.prisma.$queryRaw<Array<{ day: string; total: bigint }>>`
      SELECT DATE_FORMAT(TIMESTAMPADD(MINUTE, ${offsetMinutes}, login_at), '%Y-%m-%d') AS day,
             COUNT(*) AS total
      FROM sys_login_log
      WHERE status = ${LogResult.SUCCESS}
        AND login_at >= ${start.toDate()}
        AND login_at <= ${end.toDate()}
      GROUP BY day
    `;

    return fillDailyCounts(rows, start, count);
  }

  /** 近 N 日请求量 / 错误数趋势（默认 7，最大 30）。 */
  async getRequestTrend(days = 7): Promise<RequestTrend> {
    const count = safeDays(days);
    const start = dayjs()
      .subtract(count - 1, 'day')
      .startOf('day');
    const end = dayjs().endOf('day');
    const offsetMinutes = timezoneOffsetMinutes();

    const rows = await this.prisma.$queryRaw<Array<{ day: string; total: bigint; errors: bigint | null }>>`
      SELECT DATE_FORMAT(TIMESTAMPADD(MINUTE, ${offsetMinutes}, time), '%Y-%m-%d') AS day,
             COUNT(*) AS total,
             SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
      FROM sys_http_log
      WHERE time >= ${start.toDate()}
        AND time <= ${end.toDate()}
      GROUP BY day
    `;

    // 错误数与请求数共用同一份日期轴：两个序列都来自同一次聚合，缺勤日一并补 0。
    const filled = fillDailyCounts(rows, start, count);
    const errorsByDay = new Map(rows.map((row) => [row.day, Number(row.errors ?? 0)]));
    const errors = filled.dates.map((_, i) => {
      const day = start.add(i, 'day').format('YYYY-MM-DD');
      return errorsByDay.get(day) ?? 0;
    });
    return { dates: filled.dates, requests: filled.counts, errors };
  }

  /** 近 N 日活跃用户趋势（每日成功登录的去重账号数）。 */
  async getActiveUserTrend(days = 7): Promise<ActiveUserTrend> {
    const count = safeDays(days);
    const start = dayjs()
      .subtract(count - 1, 'day')
      .startOf('day');
    const end = dayjs().endOf('day');
    const offsetMinutes = timezoneOffsetMinutes();

    const rows = await this.prisma.$queryRaw<Array<{ day: string; total: bigint }>>`
      SELECT DATE_FORMAT(TIMESTAMPADD(MINUTE, ${offsetMinutes}, login_at), '%Y-%m-%d') AS day,
             COUNT(DISTINCT username) AS total
      FROM sys_login_log
      WHERE status = ${LogResult.SUCCESS}
        AND login_at >= ${start.toDate()}
        AND login_at <= ${end.toDate()}
      GROUP BY day
    `;

    return fillDailyCounts(rows, start, count);
  }

  /** 操作类型分布（按动作聚合）。 */
  async getOperationDistribution(): Promise<NameValue[]> {
    const rows = (await this.prisma.operationLog.groupBy({
      by: ['action'],
      _count: { id: true },
    })) as unknown as Array<{ action: string; _count: { id: number } }>;

    return rows.map((row) => ({ name: row.action, value: Number(row._count.id) }));
  }

  /** 各角色用户数。 */
  async getRoleUserCount(): Promise<RoleUserCount> {
    const roles = await this.prisma.role.findMany({
      select: { id: true, roleName: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });

    const rows = (await this.prisma.userRole.groupBy({
      by: ['roleId'],
      _count: { _all: true },
    })) as unknown as Array<{ roleId: bigint; _count: { _all: number } }>;

    const countMap = new Map<number, number>();
    rows.forEach((row) => countMap.set(Number(row.roleId), Number(row._count._all)));

    return {
      names: roles.map((role) => role.roleName),
      counts: roles.map((role) => countMap.get(Number(role.id)) ?? 0),
    };
  }
}
