/**
 * 登录频率限制中间件（零依赖，进程内滑动窗口）。
 * 模块职责：统计登录失败次数，超限即返回 429。采用**双维度并存**：
 *  1. 账号维度：键 =「客户端 IP + 用户名」，防「集中爆破某个固定账号」；
 *  2. IP 维度：键 =「客户端 IP」，防「同一来源轮换大量 username 撞库/撒网」（账号维度对此无效）。
 * 任一维度超限即拒绝；登录成功后仅清零账号维度计数（IP 维度作为兜底，仅随窗口自然滑出）。
 *
 * 设计要点：
 * - 滑动窗口：仅统计最近一个窗口内的失败时间戳，过期自动失效；
 * - 仅在「密码/账号错误（401）」时计失败，参数校验失败（400）等不计入；
 * - IP 维度阈值刻意比账号维度宽松，避免办公室 N 人共用出口 IP 时被误伤。
 *
 * 局限（重要，勿误判为实现缺陷）：
 * - 进程内内存方案：**进程重启即清空**，且**多实例部署不共享**计数；
 * - **真实生产建议在反向代理层（如 nginx `limit_req`）做限流**，应用层此处为兜底；
 * - 当前为单体部署，够用；将来集群化需改用 Redis 等共享存储。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getClientIp } from '@/utils/logger';
import { AppError } from '@/utils/response';

/** 账号维度：统计窗口（5 分钟）。 */
const ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

/** 账号维度：窗口内允许的最大连续失败次数；达到即锁定。 */
const ACCOUNT_MAX_FAILURES = 5;

/** 账号维度：触发后的锁定时长（15 分钟）。 */
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

/** IP 维度：统计窗口（5 分钟）。 */
const IP_WINDOW_MS = 5 * 60 * 1000;

/** IP 维度：窗口内同一 IP 允许的最大失败次数（比账号维度宽松，避免共用出口 IP 误伤）。 */
const IP_MAX_FAILURES = 20;

/** 惰性清理的调用间隔：每 N 次请求做一次过期键清理，避免 Map 无限增长。 */
const SWEEP_INTERVAL = 200;

/** 单个账号键的计数状态。 */
interface FailureRecord {
  /** 窗口内的失败时间戳（毫秒）列表 */
  failures: number[];
  /** 锁定截止时间戳；0 表示未锁定 */
  lockedUntil: number;
}

/** 账号维度状态表：key「IP|username」→ 计数状态。 */
const accountStore = new Map<string, FailureRecord>();

/** IP 维度状态表：key「IP」→ 窗口内失败时间戳列表。 */
const ipStore = new Map<string, number[]>();

/** 自上次清理以来经过的请求数。 */
let sinceSweep = 0;

/** 获取（或初始化）指定账号键的状态。 */
function getAccountRecord(key: string): FailureRecord {
  let record = accountStore.get(key);
  if (!record) {
    record = { failures: [], lockedUntil: 0 };
    accountStore.set(key, record);
  }
  return record;
}

/** 过滤出窗口内的失败时间戳。 */
function withinWindow(times: number[], now: number, windowMs: number): number[] {
  return times.filter((ts) => now - ts < windowMs);
}

/** 清理两个维度中已过期（无窗口内失败且未锁定）的键，防止 Map 无限增长。 */
function sweepExpired(now: number): void {
  accountStore.forEach((record, key) => {
    const hasRecentFailure = record.failures.some((ts) => now - ts < ACCOUNT_WINDOW_MS);
    const locked = record.lockedUntil > now;
    if (!hasRecentFailure && !locked) {
      accountStore.delete(key);
    }
  });
  ipStore.forEach((times, key) => {
    if (withinWindow(times, now, IP_WINDOW_MS).length === 0) {
      ipStore.delete(key);
    }
  });
}

/** 由客户端 IP 与请求用户名构造账号维度键：优先 IP + username，取不到 username 时退化为仅 IP。 */
function buildAccountKey(req: Request, ip: string): string {
  const body = req.body as { username?: unknown } | undefined;
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  return username ? `${ip}|${username}` : ip;
}

/**
 * 生成登录频率限制中间件。
 * @returns Express 中间件
 */
export function loginRateLimit(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sinceSweep += 1;
    if (sinceSweep >= SWEEP_INTERVAL) {
      sinceSweep = 0;
      sweepExpired(now);
    }

    const ip = getClientIp(req);

    // ① IP 维度（撞库/撒网防护）：窗口内失败达阈值即拒绝。message 与账号锁定区分，便于排查。
    const ipFailures = withinWindow(ipStore.get(ip) ?? [], now, IP_WINDOW_MS);
    if (ipFailures.length >= IP_MAX_FAILURES) {
      next(AppError.tooManyRequests('该网络登录尝试过于频繁，请稍后重试'));
      return;
    }

    // ② 账号维度（针对固定账号的爆破防护）
    const accountKey = buildAccountKey(req, ip);
    const record = getAccountRecord(accountKey);

    if (record.lockedUntil > now) {
      const remainMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      next(AppError.tooManyRequests(`登录失败次数过多，账号已锁定，请在 ${remainMinutes} 分钟后重试`));
      return;
    }

    // 锁定已过期：清除该次锁定与过期失败记录，重新开始统计
    if (record.lockedUntil !== 0 && record.lockedUntil <= now) {
      record.lockedUntil = 0;
    }
    record.failures = withinWindow(record.failures, now, ACCOUNT_WINDOW_MS);

    res.on('finish', () => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        // 登录成功：清零账号维度计数（IP 维度不在此清零，作为兜底仅随窗口滑出）
        accountStore.delete(accountKey);
        return;
      }
      if (status !== 401) {
        // 仅账号/密码错误计入失败；其它状态（400 校验失败等）不计
        return;
      }
      const finishedAt = Date.now();

      // 账号维度：记录失败并在达阈值时锁定
      const current = getAccountRecord(accountKey);
      current.failures = withinWindow(current.failures, finishedAt, ACCOUNT_WINDOW_MS);
      current.failures.push(finishedAt);
      if (current.failures.length >= ACCOUNT_MAX_FAILURES) {
        current.lockedUntil = finishedAt + ACCOUNT_LOCK_MS;
      }

      // IP 维度：记录失败（仅保留窗口内时间戳）
      ipStore.set(ip, [...withinWindow(ipStore.get(ip) ?? [], finishedAt, IP_WINDOW_MS), finishedAt]);
    });

    next();
  };
}
