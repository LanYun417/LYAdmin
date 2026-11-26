/**
 * 鉴权守卫与请求上下文装饰器。
 * 模块职责：解析 Bearer Token、校验 accessToken、查库校验用户状态（强制下线）、
 * 校验改密后旧 Token 失效与登出黑名单，并把用户上下文挂载到请求对象。
 */
import { createHash } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../exception/app.exception.js';
import { ERROR_MESSAGE, Status } from '../config/constants.js';
import { JwtService } from './jwt.service.js';
import { SessionService } from './session.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { RedisService } from '../redis/redis.service.js';
// 同 AuthUserService：PrismaService 参与依赖注入，必须是值导入
import { PrismaService } from '../../prisma/prisma.service.js';
// 必须为**值导入**（非 import type）：Nest 依赖注入需要运行时的构造函数引用，
// 用 import type 会在 emitDecoratorMetadata 下退化为 Function，导致无法解析依赖。
import { AuthUserService } from './auth-user.service.js';
import { getClientIp } from '../log/operation-log.interceptor.js';
import { matchIpRule } from '../ip/ip-match.js';
import type { AuthContext, AuthUserContext } from '../types.js';

/** 解析 JSON 字符串数组；任何异常/非数组都归一为空数组（不让脏数据放大成 500）。 */
function parseJsonArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

/** 请求对象扩展：挂载鉴权上下文。 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUserContext;
  /** 已加载的完整鉴权上下文，供控制器复用避免重复查库 */
  authContext?: AuthContext | null;
  tokenIat?: number;
  /** 当前令牌所属会话 id（供「登出」摘除会话记录；旧令牌无此字段） */
  tokenSid?: string;
}

/** 公开接口标记：跳过鉴权。 */
export const IS_PUBLIC_KEY = 'ly:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** 读取请求中的 accessToken：优先 Authorization 头，回退 `?token=`（静态资源场景）。 */
export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      return token;
    }
  }
  // 浏览器 <img>/<el-avatar> 无法自动带 Authorization 头，故前端在静态资源 URL 上拼 ?token=
  const queryToken = (req.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }
  return null;
}

/**
 * 执行鉴权核心逻辑，返回用户上下文；失败抛 AppException。
 * 供守卫与静态资源中间件复用。
 */
export async function authenticateRequest(
  req: Request,
  jwtService: JwtService,
  blacklist: TokenBlacklistService,
  authUserService: AuthUserService,
  sessionService: SessionService,
  redis: RedisService,
  sidHolder: { value?: string } = {},
): Promise<{ user: AuthUserContext; context: AuthContext | null }> {
  const token = extractToken(req);
  if (!token) {
    throw AppException.unauthorized('未提供访问令牌');
  }

  let payload;
  try {
    payload = await jwtService.verifyAccessToken(token);
  } catch (error) {
    if (jwtService.isExpiredError(error)) {
      throw AppException.unauthorized('登录已过期，请重新登录');
    }
    // jose 把「结构非法」「签名不符」等都归为 JWTInvalid / JWTClaimValidationFailed，
    // 统一按「令牌无效」处理，**不把内部错误细节透给客户端**。
    if (jwtService.isInvalidError(error)) {
      throw AppException.unauthorized('访问令牌无效');
    }
    // 兜底：任何其它解析异常同样按 401 处理（而非 500），避免泄露实现细节
    throw AppException.unauthorized('访问令牌无效');
  }

  // MFA 挑战令牌是登录流程的中间产物（第一因子已过、第二因子未验证），
  // **不得**当普通访问令牌使用——否则一个 5 分钟窗口就能绕过二次验证。
  if (payload.purpose) {
    throw AppException.unauthorized('访问令牌无效');
  }

  const context = await authUserService.loadAuthUser(Number(payload.userId));
  if (!context) {
    throw AppException.unauthorized('用户不存在');
  }

  // 强制下线：账号被禁用即失效
  if (Number(context.status) !== Status.ENABLED) {
    throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
  }

  // 改密后旧 Token 失效
  if (context.passwordChangedAt) {
    const changedAt = new Date(context.passwordChangedAt).getTime();
    if (payload.iat * 1000 < changedAt) {
      throw AppException.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
    }
  }

  // 登出后旧 Token 失效（Redis 黑名单）
  if (await blacklist.isTokenRevoked(context.userId, payload.iat)) {
    throw AppException.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
  }

  // 会话已被强制下线 / 已登出：令牌携带的 sid 在 Redis 中已无对应记录
  // 注意「只在 Redis 可用时才判定」——否则 Redis 一挂，全体用户会被立刻登出，
  // 与项目对 Redis 的整体降级策略（可用则增强、不可用则放行）相违背。
  if (payload.sid && redis.isReady()) {
    if (!(await sessionService.isAlive(payload.sid))) {
      throw AppException.unauthorized(ERROR_MESSAGE.SESSION_REVOKED);
    }
  }

  // sid 需要挂到请求上供登出使用；通过闭包返回避免改 AuthUserContext 结构
  sidHolder.value = payload.sid;

  const user: AuthUserContext = {
    userId: context.userId,
    username: context.username,
    roles: context.roleCodes,
    permissions: context.permissions,
    status: Number(context.status),
    deptId: Number(context.deptId ?? 0),
    deptName: context.deptName ?? null,
    tokenIat: payload.iat,
  };
  return { user, context };
}

/**
 * 全局鉴权守卫（APP_GUARD）。
 * 默认全部接口需鉴权，`@Public()` 显式放行（登录、验证码、健康检查、接口文档）。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // API Key 通道：`Authorization: Bearer lyak_xxx` 走服务账号鉴权
    // （JWT 与 API Key 不可能同前缀：JWT 以 eyJ 开头，语义上零歧义）
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer lyak_')) {
      await this.authenticateApiKey(header.slice(7).trim(), req);
      return true;
    }

    const sidHolder: { value?: string } = {};
    const { user, context: authContext } = await authenticateRequest(
      req,
      this.jwtService,
      this.blacklist,
      this.authUserService,
      this.sessionService,
      this.redis,
      sidHolder,
    );
    req.user = user;
    req.tokenIat = user.tokenIat;
    req.tokenSid = sidHolder.value;
    req.authContext = authContext;
    return true;
  }

  /**
   * API Key 鉴权：哈希命中 → 状态/过期/IP 白名单校验 → 以所属用户身份挂载上下文。
   *
   * 权限口径：Key 的 scopes 为空 = 与所属用户完全一致（最简单、最常见）；
   * 非空 = 在用户权限基础上再取交集（缩小范围，绝不放大）。
   * lastUsedAt 异步更新（不阻塞请求，写失败仅丢统计）。
   */
  private async authenticateApiKey(rawKey: string, req: AuthenticatedRequest): Promise<void> {
    if (rawKey.length < 16) {
      throw AppException.unauthorized('API Key 无效');
    }
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const row = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!row) {
      throw AppException.unauthorized('API Key 无效');
    }
    const fail = (reason: string): never => {
      throw AppException.unauthorized(`API Key 不可用：${reason}`);
    };
    if (Number(row.status) !== Status.ENABLED) {
      fail('已停用');
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      fail('已过期');
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, username: true, status: true, deptId: true },
    });
    if (!owner || Number(owner.status) !== Status.ENABLED) {
      fail('所属账号不存在或已被禁用');
    }
    // IP 白名单（非白名单直接拒；解析不了的条目跳过，不让配置错误锁死合法调用方）
    const allowIps = parseJsonArray(row.allowIps);
    if (allowIps.length > 0) {
      const ip = getClientIp(req);
      const matched = allowIps.some((pattern) => matchIpRule(ip, pattern));
      if (!matched) {
        fail('调用 IP 不在白名单');
      }
    }

    // 用户级权限上下文（与 JWT 登录同一加载路径，保证口径一致）
    const ctx = await this.authUserService.loadAuthUser(Number(row.userId));
    if (!ctx) {
      throw AppException.unauthorized('API Key 所属用户不存在');
    }
    const scopes = parseJsonArray(row.scopes).filter((item) => item.length > 0);
    const permissions = scopes.length > 0 ? ctx.permissions.filter((code) => scopes.includes(code)) : ctx.permissions;
    req.user = {
      userId: ctx.userId,
      username: ctx.username,
      roles: ctx.roleCodes,
      permissions,
      status: Number(ctx.status),
      deptId: ctx.deptId,
      deptName: ctx.deptName ?? null,
      // API Key 不参与改密失效与登出黑名单（没有 iat/sid 概念）
      tokenIat: 0,
    };
    req.authContext = { ...ctx, permissions };

    // 使用统计：异步更新，失败无所谓
    void this.prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
}

/** 参数装饰器：读取当前登录用户。 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUserContext => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.user) {
    throw AppException.unauthorized();
  }
  return req.user;
});

/** 参数装饰器：读取已加载的鉴权上下文（含角色码/权限码），供控制器复用避免重复查库。 */
export const ReqAuthContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.authContext ?? null;
});
