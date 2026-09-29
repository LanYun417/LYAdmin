/**
 * 登录频率限制中间件（Redis 共享存储，双维度）。
 * 模块职责：统计登录失败次数，超限即返回 429。采用**双维度并存**：
 *  1. 账号维度：键 =「客户端 IP + 用户名」，防「集中爆破某个固定账号」；
 *  2. IP 维度：键 =「客户端 IP」，防「同一来源轮换大量 username 撞库/撒网」（账号维度对此无效）。
 * 任一维度超限即拒绝；登录成功后仅清零账号维度计数（IP 维度作为兜底，随窗口自然过期）。
 *
 * 与旧版（进程内内存）的差异：
 * - 旧版为进程内 `Map`，**进程重启即清空**且**多实例不共享**；本版改用 Redis，跨重启/跨实例生效；
 * - 计数窗口由「滑动窗口」改为「固定窗口」（基于 Redis `INCR` + `EXPIRE`），实现更稳健，
 *   对频率限制目标（拦爆破/撞库）无实质影响；账号维度触发后仍保留独立的「锁定键」(TTL=15min)。
 *
 * 降级：Redis 不可用/未配置时，本中间件**直接放行**且不计数（fail-open），避免 Redis 故障
 * 阻塞登录（宁可限流失效，不可阻断正常登录）。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { isRedisReady, redis } from '@/config/redis';
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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = getClientIp(req);
    const accountKey = buildAccountKey(req, ip);
    const acctFailKey = `login:fail:acct:${accountKey}`;
    const acctLockKey = `login:lock:acct:${accountKey}`;
    const ipFailKey = `login:fail:ip:${ip}`;

    // Redis 不可用 → 降级放行（不阻断登录），也不计数
    if (!isRedisReady()) {
      next();
      return;
    }

    try {
      // ① 账号锁定：命中锁定键直接拒绝（锁由失败累计触发，TTL=ACCOUNT_LOCK_MS）
      const locked = await redis!.get(acctLockKey);
      if (locked) {
        const ttl = await redis!.pTTL(acctLockKey);
        const remainMinutes = Math.max(1, Math.ceil((ttl > 0 ? ttl : ACCOUNT_LOCK_MS) / 60000));
        next(AppError.tooManyRequests(`登录失败次数过多，账号已锁定，请在 ${remainMinutes} 分钟后重试`));
        return;
      }

      // ② IP 维度（撞库/撒网防护）：读取窗口内失败计数（仅失败计入，成功不增）
      const ipRaw = await redis!.get(ipFailKey);
      const ipFailures = ipRaw ? Number(ipRaw) : 0;
      if (ipFailures >= IP_MAX_FAILURES) {
        next(AppError.tooManyRequests('该网络登录尝试过于频繁，请稍后重试'));
        return;
      }
    } catch {
      // Redis 读取异常 → 降级放行（fail-open），避免因中间件自身异常锁死登录
      next();
      return;
    }

    // 请求结束后，按响应状态累计失败 / 清零账号维度
    res.on('finish', () => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        // 登录成功：清零账号维度计数（IP 维度随窗口自然过期，不作清除）
        void redis!.del(acctFailKey).catch(() => {});
        return;
      }
      if (status !== 401) {
        // 仅账号/密码错误计入失败；其它状态（400 校验失败等）不计
        return;
      }

      // 账号维度：累计失败；达到阈值即上锁
      void (async () => {
        try {
          const count = await redis!.incr(acctFailKey);
          if (count === 1) {
            await redis!.expire(acctFailKey, Math.ceil(ACCOUNT_WINDOW_MS / 1000));
          }
          if (count >= ACCOUNT_MAX_FAILURES) {
            await redis!.set(acctLockKey, '1', { PX: ACCOUNT_LOCK_MS });
          }
        } catch {
          // 降级：计数失败不影响登录结果
        }
      })();

      // IP 维度：累计失败（仅保留窗口内计数，由 EXPIRE 自然过期）
      void (async () => {
        try {
          const count = await redis!.incr(ipFailKey);
          if (count === 1) {
            await redis!.expire(ipFailKey, Math.ceil(IP_WINDOW_MS / 1000));
          }
        } catch {
          // 降级
        }
      })();
    });

    next();
  };
}
