/**
 * 首页仪表盘接口：统计卡片、三类趋势、操作类型分布与各角色用户数。
 */
import { get } from './request';
import type { DashboardStats, LoginTrend, NameValue, RequestTrend, RoleUserCount } from '@/types/api';

/** 统计卡片 */
export function getDashboardStatsApi(): Promise<DashboardStats> {
  return get<DashboardStats>('/dashboard/stats');
}

/** 近 N 日登录趋势 */
export function getLoginTrendApi(days = 7): Promise<LoginTrend> {
  return get<LoginTrend>('/dashboard/login-trend', { days });
}

/** 近 N 日请求量 / 错误数趋势 */
export function getRequestTrendApi(days = 7): Promise<RequestTrend> {
  return get<RequestTrend>('/dashboard/request-trend', { days });
}

/** 近 N 日活跃用户趋势（结构与登录趋势一致） */
export function getActiveUserTrendApi(days = 7): Promise<LoginTrend> {
  return get<LoginTrend>('/dashboard/active-user-trend', { days });
}

/** 操作类型分布 */
export function getOperationDistributionApi(): Promise<NameValue[]> {
  return get<NameValue[]>('/dashboard/operation-distribution');
}

/** 各角色用户数 */
export function getRoleUserCountApi(): Promise<RoleUserCount> {
  return get<RoleUserCount>('/dashboard/role-user-count');
}
