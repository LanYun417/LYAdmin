/**
 * 健康检查控制器。
 * 模块职责：区分「进程存活（live）」与「依赖就绪（ready）」两类探针，供容器编排 / 负载均衡
 * 判断实例能否接流量；并保留原有的 `GET /api` 根探活（对外契约不变）。
 *
 * 口径（为什么这样分）：
 * - `live`：只证明进程还能响应，**不碰任何依赖**。容器 livenessProbe 用它——若这里探 DB，
 *   数据库抖动会导致所有实例被反复重启，反而放大故障。
 * - `ready`：探测 MySQL 与 Redis。
 *   · MySQL 不可用 → **HTTP 503**：此时所有业务接口都不可用，不该再接流量；
 *   · Redis 不可用 → **HTTP 200 且 status=degraded**：项目对 Redis 是降级设计
 *     （登出黑名单 / 登录限流 / 验证码共享存储停用，登录与鉴权仍正常工作），
 *     若也返回 503，Redis 抖动会把整个集群摘空。
 *   Redis 未配置（`REDIS_HOST` 为空）时状态为 `disabled`，不算故障。
 *
 * 版本信息取自环境变量（`APP_VERSION` / `GIT_COMMIT`，由构建产物注入），未注入时为 `dev`。
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/auth.guard.js';
import { config } from '../../common/config/config.js';
import { AppException } from '../../common/exception/app.exception.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 应用标识与构建信息。 */
const APP_NAME = 'ly-admin-api';
const APP_VERSION = process.env.APP_VERSION ?? 'dev';
const GIT_COMMIT = process.env.GIT_COMMIT ?? '';

/** 单项依赖探测结果。 */
interface DependencyCheck {
  /** up 正常 / down 不通 / disabled 未启用（仅 Redis 可能出现） */
  status: 'up' | 'down' | 'disabled';
  /** 探测耗时（毫秒） */
  latencyMs: number;
}

/** live 探针响应。 */
interface LiveStatus {
  name: string;
  status: 'ok';
  version: string;
  commit: string;
  env: string;
  /** 进程运行秒数 */
  uptime: number;
  time: string;
}

/** ready 探针响应。 */
interface ReadyStatus extends Omit<LiveStatus, 'status'> {
  /** ready 全部依赖正常 / degraded 核心可用但可选依赖降级 */
  status: 'ready' | 'degraded';
  checks: {
    db: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 根探活（`GET /api`）：契约保持不变，另附 uptime / version 便于排查。 */
  @Public()
  @Get()
  health(): { name: string; status: string; time: string; version: string; uptime: number } {
    return {
      name: APP_NAME,
      status: 'ok',
      time: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.floor(process.uptime()),
    };
  }

  /** 存活探针：不碰任何依赖，只要进程能响应即 200。 */
  @Public()
  @Get('health/live')
  live(): LiveStatus {
    return { ...this.baseInfo(), status: 'ok' };
  }

  /** 就绪探针：MySQL 不通返回 503；Redis 不通降级为 degraded（仍 200）。 */
  @Public()
  @Get('health/ready')
  async ready(): Promise<ReadyStatus> {
    const [db, redisCheck] = await Promise.all([this.checkDb(), this.checkRedis()]);
    if (db.status === 'down') {
      throw AppException.serviceUnavailable('依赖未就绪：MySQL 不可用');
    }
    return {
      ...this.baseInfo(),
      status: redisCheck.status === 'down' ? 'degraded' : 'ready',
      checks: { db, redis: redisCheck },
    };
  }

  /** 公共元信息（名称 / 版本 / 环境 / 运行时长 / 时间）。 */
  private baseInfo(): Omit<LiveStatus, 'status'> {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      commit: GIT_COMMIT,
      env: config.env,
      uptime: Math.floor(process.uptime()),
      time: new Date().toISOString(),
    };
  }

  /** 探测 MySQL（`SELECT 1`），任何异常都视为 down，不向上抛。 */
  private async checkDb(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch {
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  /** 探测 Redis：未配置 → disabled；配置了但 ping 不通 → down。 */
  private async checkRedis(): Promise<DependencyCheck> {
    if (!config.redis.host) {
      return { status: 'disabled', latencyMs: 0 };
    }
    const startedAt = Date.now();
    const ok = await this.redis.ping();
    return { status: ok ? 'up' : 'down', latencyMs: Date.now() - startedAt };
  }
}
