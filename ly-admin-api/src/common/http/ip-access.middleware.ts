/**
 * IP 访问控制中间件（黑名单拦截 / 白名单放行）。
 *
 * 注册顺序（见 app.module.ts）：在访问日志之后、限流之前——
 * - 访问日志先记录：被拦的请求也留痕，便于排查是谁在撞规则；
 * - 限流之前：命中黑名单的请求直接 403，不再消耗限流计数（省一次 Redis 往返）。
 *
 * 判定口径（见 IpRuleService.decide）：白名单优先于黑名单，支持「误封后加白名单自救」。
 * 另有一层静态豁免（IP_ACCESS_EXEMPT_IPS，环境变量），这些 IP 永不封禁，防运维把自己锁在外面。
 *
 * 降级：规则表不可用 / 判定时异常 → 放行。访问控制是防护，不能因自身故障阻断业务。
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/config.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../config/constants.js';
import { matchIpRule } from '../ip/ip-match.js';
import { IpRuleService } from '../../modules/ip-rule/ip-rule.service.js';

@Injectable()
export class IpAccessMiddleware implements NestMiddleware {
  constructor(private readonly ipRules: IpRuleService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!config.ipAccess.enabled) {
      next();
      return;
    }

    // 与访问日志、限流保持同一取 IP 口径（trust proxy 生效时取 X-Forwarded-For）
    const ip = req.ip ?? '';
    if (ip && config.ipAccess.exemptIps.some((pattern) => matchIpRule(ip, pattern))) {
      next();
      return;
    }

    try {
      const decision = await this.ipRules.decide(ip);
      if (!decision.allowed) {
        res.status(ERROR_CODE.FORBIDDEN).json({
          code: ERROR_CODE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
          data: null,
        });
        return;
      }
    } catch {
      // 判定异常（DB 抖动等）→ 放行，与限流 / 会话的降级策略一致
    }
    next();
  }
}
