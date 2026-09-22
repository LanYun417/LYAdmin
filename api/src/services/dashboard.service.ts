/**
 * 仪表盘服务。
 * 模块职责：聚合统计卡片、登录趋势、操作分布、角色用户数等数据。
 */
import dayjs from 'dayjs';
import { col, fn, Op } from 'sequelize';
import { LogResult } from '@/constants';
import { LoginLog, Menu, OperationLog, Role, User, UserRole } from '@/models';
import type { DashboardStats } from '@/types';

/**
 * 统计卡片数据。
 */
export async function getStats(): Promise<DashboardStats> {
  const startOfToday = dayjs().startOf('day').toDate();
  const endOfToday = dayjs().endOf('day').toDate();

  const [userTotal, roleTotal, menuTotal, todayLoginCount] = await Promise.all([
    User.count(),
    Role.count(),
    Menu.count(),
    LoginLog.count({
      where: {
        loginAt: { [Op.between]: [startOfToday, endOfToday] },
        status: LogResult.SUCCESS,
      },
    }),
  ]);

  return { userTotal, roleTotal, menuTotal, todayLoginCount };
}

/**
 * 近 N 日登录趋势。
 * @param days 天数（默认 7，最大 30）
 */
export async function getLoginTrend(days = 7): Promise<{ dates: string[]; counts: number[] }> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 30) : 7;
  const dates: string[] = [];
  const counts: number[] = [];

  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const day = dayjs().subtract(i, 'day');
    const count = await LoginLog.count({
      where: {
        loginAt: { [Op.between]: [day.startOf('day').toDate(), day.endOf('day').toDate()] },
        status: LogResult.SUCCESS,
      },
    });
    dates.push(day.format('MM-DD'));
    counts.push(count);
  }

  return { dates, counts };
}

/**
 * 操作类型分布（按动作聚合）。
 */
export async function getOperationDistribution(): Promise<{ name: string; value: number }[]> {
  const rows = (await OperationLog.findAll({
    attributes: ['action', [fn('COUNT', col('id')), 'count']],
    group: ['action'],
    raw: true,
  })) as unknown as Array<{ action: string; count: number | string }>;

  return rows.map((row) => ({ name: row.action, value: Number(row.count) }));
}

/**
 * 各角色用户数。
 */
export async function getRoleUserCount(): Promise<{ names: string[]; counts: number[] }> {
  const roles = await Role.findAll({
    attributes: ['id', 'roleName'],
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const rows = (await UserRole.findAll({
    attributes: ['roleId', [fn('COUNT', col('user_id')), 'count']],
    group: ['roleId'],
    raw: true,
  })) as unknown as Array<{ roleId: number | string; count: number | string }>;

  const countMap = new Map<number, number>();
  rows.forEach((row) => countMap.set(Number(row.roleId), Number(row.count)));

  return {
    names: roles.map((role) => role.roleName),
    counts: roles.map((role) => countMap.get(Number(role.id)) ?? 0),
  };
}
