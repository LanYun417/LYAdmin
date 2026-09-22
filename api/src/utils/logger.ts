/**
 * 日志工具。
 * 模块职责：提供 morgan 访问日志输出流、JSON Lines 落盘格式，以及 HTTP 日志文件读取（供 `/api/logs/http` 使用）。
 */
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import morgan from 'morgan';
import { config } from '@/config';

/**
 * 解析客户端真实 IP（优先取代理头 `x-forwarded-for`）。
 * @param req Express 请求对象
 * @returns 客户端 IP 字符串
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip ?? req.socket.remoteAddress ?? '';
}

/** 访问日志文件绝对路径。 */
export const ACCESS_LOG_FILE = path.join(config.logDir, 'access.log');

// 确保日志目录存在
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

/** 访问日志写入流（追加模式）。 */
export const accessLogStream = fs.createWriteStream(ACCESS_LOG_FILE, { flags: 'a' });

/** 一条访问日志记录。 */
export interface HttpLogRecord {
  time: string;
  method: string;
  url: string;
  status: number;
  responseTime: number;
  ip: string;
  userAgent: string;
}

/** 访问日志查询条件。 */
export interface HttpLogQuery {
  page: number;
  pageSize: number;
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
}

/**
 * morgan 自定义格式：单行 JSON，便于解析。
 * @returns morgan format 函数
 */
export function httpLogFormat(): morgan.FormatFn {
  return (tokens, req, res) => {
    const record: HttpLogRecord = {
      time: tokens.date(req, res, 'iso') ?? new Date().toISOString(),
      method: tokens.method(req, res) ?? '',
      url: tokens.url(req, res) ?? '',
      status: Number(tokens.status(req, res) ?? 0),
      responseTime: Number(tokens['response-time'](req, res) ?? 0),
      ip: tokens['remote-addr'](req, res) ?? '',
      userAgent: tokens['user-agent'](req, res) ?? '',
    };
    return `${JSON.stringify(record)}\n`;
  };
}

/**
 * 从访问日志文件中读取并筛选记录（倒序，最新在前）。
 * @param query 查询条件（含分页）
 * @returns 分页结果 `{ list, total }`
 */
export function readHttpLogs(query: HttpLogQuery): { list: HttpLogRecord[]; total: number } {
  if (!fs.existsSync(ACCESS_LOG_FILE)) {
    return { list: [], total: 0 };
  }

  const content = fs.readFileSync(ACCESS_LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');

  const records: HttpLogRecord[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as HttpLogRecord;
      records.push(parsed);
    } catch {
      // 忽略无法解析的历史行
    }
  }

  const filtered = records.filter((record) => {
    if (query.method && record.method.toUpperCase() !== query.method.toUpperCase()) {
      return false;
    }
    if (query.statusCode && record.status !== query.statusCode) {
      return false;
    }
    if (query.startTime && record.time < query.startTime) {
      return false;
    }
    if (query.endTime && record.time > query.endTime) {
      return false;
    }
    return true;
  });

  // 倒序：最新在前
  filtered.reverse();

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const list = filtered.slice(start, start + query.pageSize);

  return { list, total };
}
