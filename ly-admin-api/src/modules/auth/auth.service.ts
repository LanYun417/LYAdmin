/**
 * 认证服务。
 * 模块职责：登录校验、双 Token 签发、刷新、用户上下文组装、菜单树下发。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { CaptchaService } from '../../common/auth/captcha.service.js';
import { ERROR_MESSAGE, LogResult, Status } from '../../common/config/constants.js';
import { lookupDeptName } from '../../common/utils/dept-lookup.js';
import { IpRegionService } from '../../common/ip/ip-region.service.js';
import { JwtService } from '../../common/auth/jwt.service.js';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service.js';
import { comparePassword } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUserService } from '../../common/auth/auth-user.service.js';
import type { AuthContext, JwtPayload, UserBrief } from '../../common/types.js';

/** 登录结果。 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

/** Token 对。 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authCache: AuthCacheService,
    private readonly authUserService: AuthUserService,
    private readonly ipRegion: IpRegionService,
  ) {}

  /** 将用户记录转换为对外简要信息。 */
  private toUserBrief(user: {
    id: bigint;
    username: string;
    nickname: string;
    avatar: string | null;
    email: string | null;
    phone: string | null;
    gender: string | null;
    status: number;
    deptId: bigint;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    dept?: { deptName: string } | null;
  }): UserBrief {
    return {
      id: Number(user.id),
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone,
      gender: user.gender ?? null,
      status: Number(user.status),
      deptId: Number(user.deptId ?? 0),
      deptName: user.dept?.deptName ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 组装 toUserBrief 所需的部门片段。
   * sys_user.dept_id 不建外键（0 = 未分配），schema 中无 Prisma 关系，故按 deptId 显式补查。
   */
  private async deptRef(deptId: bigint): Promise<{ deptName: string } | null> {
    const deptName = await lookupDeptName(this.prisma, deptId);
    return deptName === null ? null : { deptName };
  }

  /** 写入登录日志（失败不阻断）。 */
  private async writeLoginLog(
    username: string,
    ip: string,
    userAgent: string,
    status: LogResult,
    message: string,
    location: string,
  ): Promise<void> {
    try {
      await this.prisma.loginLog.create({
        data: {
          username: username.slice(0, 50),
          ip: ip ? ip.slice(0, 50) : null,
          location: location ? location.slice(0, 100) : null,
          userAgent: userAgent ? userAgent.slice(0, 500) : null,
          status,
          message: message.slice(0, 255),
          loginAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`[AuthService] 写入登录日志失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 登录：校验图形验证码、账号密码与状态，签发双 Token 并写登录日志。
   */
  async login(
    username: string,
    password: string,
    captchaId: string | undefined,
    captchaCode: string | undefined,
    ip: string,
    userAgent: string,
  ): Promise<LoginResult> {
    // 图形验证码：先校验（廉价、无 DB 查询），失败直接拒绝，避免爆破消耗数据库
    if (!(await this.captchaService.verifyCaptcha(captchaId, captchaCode))) {
      throw AppException.badRequest('验证码错误或已过期');
    }

    // 归属地解析一次即可：登录成功/失败共用（解析失败返回空串，不影响登录流程）
    const location = await this.ipRegion.locate(ip);

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.LOGIN_FAILED, location);
      throw AppException.unauthorized(ERROR_MESSAGE.LOGIN_FAILED);
    }

    const matched = await comparePassword(password, user.password);
    if (!matched) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.LOGIN_FAILED, location);
      throw AppException.unauthorized(ERROR_MESSAGE.LOGIN_FAILED);
    }

    if (Number(user.status) !== Status.ENABLED) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.ACCOUNT_DISABLED, location);
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.writeLoginLog(username, ip, userAgent, LogResult.SUCCESS, '登录成功', location);
    // 登录会更新 lastLoginAt：失效该用户鉴权缓存，避免 /auth/profile 在 TTL 内返回陈旧值
    this.authCache.invalidate(Number(user.id));

    const payload = { userId: Number(user.id), username: user.username };
    return {
      accessToken: await this.jwtService.signAccessToken(payload),
      refreshToken: await this.jwtService.signRefreshToken(payload),
      user: this.toUserBrief({ ...user, dept: await this.deptRef(user.deptId) }),
    };
  }

  /**
   * 刷新 Token：校验 refreshToken、用户状态与改密时间，签发新 Token 对。
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw AppException.unauthorized('刷新令牌无效或已过期');
    }

    const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.userId) } });
    if (!user) {
      throw AppException.unauthorized('用户不存在');
    }
    if (await this.blacklist.isTokenRevoked(Number(user.id), payload.iat)) {
      throw AppException.unauthorized(ERROR_MESSAGE.LOGOUT_INVALIDATED);
    }
    if (Number(user.status) !== Status.ENABLED) {
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }
    if (user.passwordChangedAt && payload.iat * 1000 < new Date(user.passwordChangedAt).getTime()) {
      throw AppException.unauthorized(ERROR_MESSAGE.PASSWORD_CHANGED);
    }

    const nextPayload = { userId: Number(user.id), username: user.username };
    return {
      accessToken: await this.jwtService.signAccessToken(nextPayload),
      refreshToken: await this.jwtService.signRefreshToken(nextPayload),
    };
  }

  /**
   * 获取当前用户信息（用户 + 角色码 + 权限码）。
   * 传入鉴权中间件已加载的上下文可避免重复查库。
   */
  async getProfile(
    userId: number,
    context?: AuthContext | null,
  ): Promise<{ user: UserBrief; roles: string[]; permissions: string[] }> {
    const ctx = context ?? (await this.loadFull(userId));
    if (!ctx) {
      throw AppException.notFound('用户不存在');
    }
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    return {
      user: this.toUserBrief({ ...user, dept: await this.deptRef(user.deptId) }),
      roles: ctx.roleCodes,
      permissions: ctx.permissions,
    };
  }

  /** 加载完整上下文（未命中鉴权缓存时按需查库）。 */
  private async loadFull(userId: number): Promise<AuthContext | null> {
    return this.authUserService.loadAuthUser(userId);
  }

  /** 获取当前用户权限码列表。 */
  async getPermissions(userId: number, context?: AuthContext | null): Promise<string[]> {
    const ctx = context ?? (await this.loadFull(userId));
    if (!ctx) {
      throw AppException.notFound('用户不存在');
    }
    return ctx.permissions;
  }

  /** 登出：记录登出时间，使旧令牌立即失效（依赖 Redis，不可用时静默降级）。 */
  async logout(userId: number): Promise<void> {
    await this.blacklist.recordLogout(userId);
  }
}
