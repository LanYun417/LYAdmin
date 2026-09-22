/**
 * 分页工具。
 * 模块职责：解析分页请求参数、组装统一分页响应（第 6.3 节）。
 */
import { PAGINATION } from '@/constants';
import type { PageResult } from '@/types';

/** 解析后的分页参数。 */
export interface ParsedPagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

/**
 * 解析 `page` / `pageSize`，做边界收敛。
 * @param query 原始 query 对象
 * @returns 归一化后的分页参数（含 offset/limit）
 */
export function parsePagination(query: Record<string, unknown>): ParsedPagination {
  const rawPage = Number(query.page);
  const rawSize = Number(query.pageSize);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : PAGINATION.DEFAULT_PAGE;
  let pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : PAGINATION.DEFAULT_PAGE_SIZE;
  if (pageSize > PAGINATION.MAX_PAGE_SIZE) {
    pageSize = PAGINATION.MAX_PAGE_SIZE;
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

/**
 * 组装统一分页响应结构。
 * @param list 当前页数据
 * @param total 记录总数
 * @param page 当前页
 * @param pageSize 每页条数
 */
export function buildPageResult<T>(list: T[], total: number, page: number, pageSize: number): PageResult<T> {
  return { list, total, page, pageSize };
}
