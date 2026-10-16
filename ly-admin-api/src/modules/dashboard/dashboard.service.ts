/**
 * 仪表盘服务。
 * 模块职责：聚合统计卡片、登录趋势、操作分布、角色用户数等数据。
 * 迁移自原 Express 版本的 services/dashboard.service.ts（Sequelize → Prisma）。
 */
import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { LogResult } from '../../common/constants.js';
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

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** 统计卡片数据。 */
  async getStats(): Promise<DashboardStats> {
    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const [userTotal, roleTotal, menuTotal, todayLoginCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.menu.count(),
      this.prisma.loginLog.count({
        where: {
          loginAt: { gte: startOfToday, lte: endOfToday },
          status: LogResult.SUCCESS,
        },
      }),
    ]);

    return { userTotal, roleTotal, menuTotal, todayLoginCount };
  }

  /** 近 N 日登录趋势（默认 7，最大 30）。 */
  async getLoginTrend(days = 7): Promise<LoginTrend> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 30) : 7;
    const dates: string[] = [];
    const counts: number[] = [];

    for (let i = safeDays - 1; i >= 0; i -= 1) {
      const day = dayjs().subtract(i, 'day');
      const count = await this.prisma.loginLog.count({
        where: {
          loginAt: { gte: day.startOf('day').toDate(), lte: day.endOf('day').toDate() },
          status: LogResult.SUCCESS,
        },
      });
      dates.push(day.format('MM-DD'));
      counts.push(count);
    }

    return { dates, counts };
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
