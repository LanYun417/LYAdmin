/**
 * 通用工具：分页解析、树构建、CSV、时间格式化、口令哈希。
 * 模块职责：收敛跨模块复用的纯函数，避免各处重复实现。
 * 迁移自原 Express 版本的 utils/{pagination,tree,password,datetime}.ts 与 log.service 的 toCsv。
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { PAGINATION } from './constants.js';
import type { PageResult, TreeItem, WithChildren } from './types.js';

// 启用 UTC 插件以支持按客户端时区偏移格式化
dayjs.extend(utc);

/* --------------------------------- 分页 --------------------------------- */

/** 分页解析结果。 */
export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
}

/**
 * 解析分页参数并收敛到安全范围。
 *
 * - `page`：非有限数或 ≤0 → 默认 1；否则向下取整。
 * - `pageSize`：非有限数或 ≤0 → 默认 10；**上限硬截断到 100**（静默收敛，不报错）。
 */
export function parsePagination(query: Record<string, unknown>): Pagination {
  const rawPage = Number(query.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : PAGINATION.DEFAULT_PAGE;

  const rawPageSize = Number(query.pageSize);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : PAGINATION.DEFAULT_PAGE_SIZE;

  const size = Math.min(pageSize, PAGINATION.MAX_PAGE_SIZE);
  return { page, pageSize: size, offset: (page - 1) * size, limit: size };
}

/** 组装分页响应。 */
export function buildPageResult<T>(list: T[], total: number, page: number, pageSize: number): PageResult<T> {
  return { list, total, page, pageSize };
}

/* --------------------------------- 树 --------------------------------- */

/**
 * 由扁平列表构建树。
 *
 * 规则（与原实现 1:1）：
 * - `parentId === 0`（rootParentId）为根；
 * - **父节点缺失时按根处理**（防数据丢失兜底）；
 * - 按 `sort` 升序 → 相等则 `id` 升序，**递归对每层子节点排序**；
 * - 节点固定带 `children: []`（空数组，不省略）。
 */
export function buildTree<T extends TreeItem>(list: T[], rootParentId = 0): WithChildren<T>[] {
  const map = new Map<number, WithChildren<T>>();
  list.forEach((item) => {
    map.set(Number(item.id), { ...(item as T), children: [] });
  });

  const roots: WithChildren<T>[] = [];
  map.forEach((node) => {
    const parentId = Number(node.parentId);
    const parent = map.get(parentId);
    if (parentId === rootParentId || !parent) {
      roots.push(node);
      return;
    }
    parent.children.push(node);
  });

  const sortNodes = (nodes: WithChildren<T>[]): void => {
    nodes.sort((a, b) => {
      const sortDiff = Number(a.sort ?? 0) - Number(b.sort ?? 0);
      if (sortDiff !== 0) {
        return sortDiff;
      }
      return Number(a.id) - Number(b.id);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

/** 深度优先展开树（父节点在前），返回不含 children 的浅拷贝节点。 */
export function flattenTree<T extends TreeItem>(nodes: WithChildren<T>[]): T[] {
  const result: T[] = [];
  const visit = (node: WithChildren<T>): void => {
    const { children: _children, ...rest } = node;
    result.push(rest as unknown as T);
    (node.children ?? []).forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

/** 收集树中所有节点 id。 */
export function collectIds<T extends TreeItem>(nodes: WithChildren<T>[]): number[] {
  return flattenTree(nodes).map((node) => Number(node.id));
}

/** 在树中递归查找指定 id 的节点。 */
export function findNode<T extends TreeItem>(nodes: WithChildren<T>[], id: number): WithChildren<T> | null {
  for (const node of nodes) {
    if (Number(node.id) === id) {
      return node;
    }
    const found = findNode(node.children ?? [], id);
    if (found) {
      return found;
    }
  }
  return null;
}

/* --------------------------------- 口令 --------------------------------- */

/** 生成 bcrypt 口令哈希。 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** 校验明文口令与 bcrypt 哈希是否匹配。 */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/** 计算文件内容 SHA-256（秒传/去重依据）。 */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/* --------------------------------- 时间 --------------------------------- */

/**
 * 按客户端时区偏移格式化时间。
 *
 * `offsetMinutes` 取浏览器 `Date.getTimezoneOffset()` 的值
 * （东八区为 -480，表示需在本地时间上减 8 小时得到 UTC）。
 */
export function formatDateTimeInZone(value: Date | string | null | undefined, offsetMinutes?: number): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  if (offsetMinutes === undefined || !Number.isFinite(offsetMinutes)) {
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  }
  return dayjs(date).utcOffset(offsetMinutes).format('YYYY-MM-DD HH:mm:ss');
}

/* --------------------------------- CSV --------------------------------- */

/** 单个单元格转义：含 " , 换行时用双引号包裹并双写内部引号。 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = value instanceof Date ? formatDateTimeInZone(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * 生成 CSV 字符串：UTF-8 BOM + CRLF 行尾。
 *
 * BOM 防 Excel 打开中文乱码（与原实现一致）。
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [headers.map((header) => csvCell(header)).join(',')];
  rows.forEach((row) => lines.push(row.map((cell) => csvCell(cell)).join(',')));
  return `\uFEFF${lines.join('\r\n')}`;
}

/* -------------------------------- 其它 -------------------------------- */

/** 将空字符串归一为 null（非空则 trim 后返回）。 */
export function emptyToNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** 读取字符串型查询参数并 trim，空串视为 undefined。 */
export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** 读取数值型查询参数，非法值返回 undefined。 */
export function readNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
