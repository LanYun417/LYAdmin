import { get } from './request';
import type { DashboardStats, LoginTrend, NameValue, RoleUserCount } from '@/types/api';

/** 统计卡片 */
export function getDashboardStatsApi(): Promise<DashboardStats> {
  return get<DashboardStats>('/dashboard/stats');
}

/** 近 N 日登录趋势 */
export function getLoginTrendApi(days = 7): Promise<LoginTrend> {
  return get<LoginTrend>('/dashboard/login-trend', { days });
}

/** 操作类型分布 */
export function getOperationDistributionApi(): Promise<NameValue[]> {
  return get<NameValue[]>('/dashboard/operation-distribution');
}

/** 各角色用户数 */
export function getRoleUserCountApi(): Promise<RoleUserCount> {
  return get<RoleUserCount>('/dashboard/role-user-count');
}
