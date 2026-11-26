/**
 * 认证服务。
 * 模块职责：登录校验、双 Token 签发、刷新、用户上下文组装、菜单树下发。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { CaptchaService } from '../../common/auth/captcha.service.js';
import { ERROR_MESSAGE, LogResult, Status } from '../../common/config/constants.js';
import { config } from '../../common/config/config.js';
import { lookupDeptName } from '../../common/utils/dept-lookup.js';
import { IpRegionService } from '../../common/ip/ip-region.service.js';
import { JwtService } from '../../common/auth/jwt.service.js';
import { SessionService } from '../../common/auth/session.service.js';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { comparePassword } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUserService } from '../../common/auth/auth-user.service.js';
import { ConfigService } from '../config/config.service.js';
import { NOTICE_TYPE, NoticeService } from '../notice/notice.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { LdapService } from '../ldap/ldap.service.js';
import type { AuthContext, JwtPayload, UserBrief } from '../../common/types.js';

/** 登录结果。 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
  /** 是否必须强制修改初始口令（种子默认口令 / 管理员重置密码后被置位） */
  mustChangePassword: boolean;
}

/** 登录流程所需的用户记录（含角色关联，供设备控制与令牌签发复用）。 */
interface LoginUserRecord {
  id: bigint;
  username: string;
  nickname: string;
  password: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  status: number;
  deptId: bigint;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  mustChangePassword: number;
  maxDevices: number | null;
  userRoles?: Array<{ role: { roleCode: string; maxDevices: number | null } }>;
}

/** 登录中间结果：第一因子已过、二次验证未完成。 */
export interface MfaChallengeResult {
  mfaRequired: true;
  /** 短期挑战令牌（默认 5 分钟，不可访问业务接口），凭动态码换正式令牌 */
  mfaToken: string;
}

/** 登录响应：直接下发令牌，或进入二次验证挑战。 */
export type LoginOutcome = LoginResult | MfaChallengeResult;

/** Token 对。 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** 二次验证换令牌的结果（与第一因子登录的回包结构一致，便于前端统一处理）。 */
export type MfaLoginResult = LoginResult;

/** 登录设备数上限参数键（值 0 = 不限制）。 */
const MAX_DEVICES_CONFIG_KEY = 'sys.login.maxDevices';
/** 豁免设备数上限的角色编码参数键（逗号分隔，如 `viewer,readonly`）。 */
const GUEST_ROLE_CONFIG_KEY = 'sys.login.guestRoleCodes';
/** 参数缺失 / 非法时的设备数上限兜底值。 */
const DEFAULT_MAX_DEVICES = 3;

/** 解析设备数上限：非数字 / 负数回退默认值，0 表示不限制。 */
function parseMaxDevices(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_MAX_DEVICES;
  }
  return value;
}

/** 解析逗号分隔的编码列表（去空白、去空项）。 */
function parseCodeList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly noticeService: NoticeService,
    private readonly mfaService: MfaService,
    private readonly ldapService: LdapService,
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
   * 登录：校验图形验证码、账号密码与状态。
   * 未绑定 MFA → 直接签发双 Token；已绑定 → 返回挑战结果（前端引导输入动态码）。
   */
  async login(
    username: string,
    password: string,
    captchaId: string | undefined,
    captchaCode: string | undefined,
    ip: string,
    userAgent: string,
  ): Promise<LoginOutcome> {
    // 图形验证码：先校验（廉价、无 DB 查询），失败直接拒绝，避免爆破消耗数据库
    if (!(await this.captchaService.verifyCaptcha(captchaId, captchaCode))) {
      throw AppException.badRequest('验证码错误或已过期');
    }

    // 归属地解析一次即可：登录成功/失败共用（解析失败返回空串，不影响登录流程）
    const location = await this.ipRegion.locate(ip);

    // 连带读角色编码：设备并发控制需要用它判定「访客豁免」（见 applyDeviceLimit）
    const localUser = await this.loadUserForLogin(username);
    const localPasswordOk = localUser ? await comparePassword(password, localUser.password) : false;

    // 最终参与后续流程（状态 / 设备控制 / 令牌签发）的账号：
    // 本地口令正确 → 本地账号；否则走 LDAP 回退（目录认证成功则取其本地账号，未建号则自动建号）
    // activeUser 与 localUser 同源（都是带 userRoles 的完整用户记录），供后续统一流程使用
    const activeUser = localPasswordOk
      ? localUser
      : await this.ldapFallbackLogin(username, password, ip, userAgent, location);

    if (!activeUser) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.LOGIN_FAILED, location);
      throw AppException.unauthorized(ERROR_MESSAGE.LOGIN_FAILED);
    }
    if (Number(activeUser.status) !== Status.ENABLED) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.FAIL, ERROR_MESSAGE.ACCOUNT_DISABLED, location);
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }

    // 登录成功即重新建立会话：清掉上一次登出的时间标记，
    // 否则同秒内签发的令牌会被判为"登出前签发"而立刻失效（iat 精度是秒）
    await this.blacklist.clearLogout(Number(activeUser.id));

    await this.prisma.user.update({ where: { id: activeUser.id }, data: { lastLoginAt: new Date() } });
    // 登录会更新 lastLoginAt：失效该用户鉴权缓存，避免 /auth/profile 在 TTL 内返回陈旧值
    this.authCache.invalidate(Number(activeUser.id));

    // 设备并发控制：非访客角色达到在线设备上限时，回收最旧会话后放行新登录（访客豁免）
    await this.applyDeviceLimit(activeUser);

    // 第二因子：已绑定 MFA 的账号不直接下发令牌，先给一个短期挑战令牌；
    // 设备上限已在上面收敛，挑战期间不占会话名额。
    if (await this.mfaService.isEnabled(Number(activeUser.id))) {
      await this.writeLoginLog(username, ip, userAgent, LogResult.SUCCESS, '二次验证待确认', location);
      return {
        mfaRequired: true,
        mfaToken: await this.jwtService.signMfaChallengeToken(
          { userId: Number(activeUser.id), username: activeUser.username },
          config.mfa.challengeExpiresMinutes,
        ),
      };
    }

    await this.writeLoginLog(username, ip, userAgent, LogResult.SUCCESS, '登录成功', location);
    return this.issueTokens(activeUser, ip, userAgent, location);
  }

  /**
   * 为指定用户直接签发登录态（供 SSO 回调换票使用）。
   * 复用 issueTokens 的会话登记与令牌签发，业务口径与密码登录完全一致。
   */
  async issueTokensForUser(userId: number, ip = '', userAgent = 'sso'): Promise<LoginResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: BigInt(userId) } });
    if (Number(user.status) !== Status.ENABLED) {
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }
    const location = ip ? await this.ipRegion.locate(ip) : '';
    await this.writeLoginLog(user.username, ip, userAgent, LogResult.SUCCESS, '登录成功（SSO）', location);
    return this.issueTokens(user, ip, userAgent, location);
  }

  /**
   * 二次验证通过后签发正式令牌。
   *
   * 挑战期间账号可能被禁用 / 已解绑 MFA / 挑战过期——逐一复核，
   * 任一条不满足都按 401 拒绝（宁可让用户重新登录，也不在中间态放行）。
   */
  /** 按用户名加载「登录流程所需」的用户记录（含角色关联，供设备控制与令牌签发）。 */
  private loadUserForLogin(username: string): Promise<LoginUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { username },
      include: { userRoles: { select: { role: { select: { roleCode: true, maxDevices: true } } } } },
    });
  }

  /**
   * LDAP 回退登录：本地口令校验失败时用目录凭据认证，成功则确保本地账号存在。
   *
   * 返回 null 的三种情况（调用方按「账号或密码错误」统一处理，不泄露是哪种）：
   * 1. LDAP 未配置 / 未启用 / 信封密钥缺失；
   * 2. 目录认证失败（用户不存在或口令错误）；
   * 3. 自动建号失败（未配默认角色等，异常已在内部抛出并转为登录失败）。
   */
  private async ldapFallbackLogin(
    username: string,
    password: string,
    ip: string,
    userAgent: string,
    location: string,
  ): Promise<LoginUserRecord | null> {
    if (!this.ldapService.isEnabled()) {
      return null;
    }
    const ldapUser = await this.ldapService.authenticate(username, password);
    if (!ldapUser) {
      return null;
    }
    // 目录认证成功：确保本地账号存在（不存在则按 defaultRoleCodes 自动建号）
    await this.ldapService.ensureLocalUser(ldapUser);
    await this.writeLoginLog(username, ip, userAgent, LogResult.SUCCESS, '登录成功（LDAP）', location);
    // 重新加载本地账号（含角色关联，供设备控制与令牌签发使用）
    return this.prisma.user.findUnique({
      where: { username: ldapUser.username },
      include: { userRoles: { select: { role: { select: { roleCode: true, maxDevices: true } } } } },
    });
  }

  async verifyMfaLogin(mfaToken: string, code: string, ip: string, userAgent: string): Promise<LoginResult> {
    const challenge = await this.jwtService.verifyMfaChallengeToken(mfaToken).catch(() => {
      throw AppException.unauthorized('二次验证已过期，请重新登录');
    });
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(challenge.userId) },
      include: { userRoles: { select: { role: { select: { roleCode: true } } } } },
    });
    if (!user || Number(user.status) !== Status.ENABLED) {
      throw AppException.unauthorized(ERROR_MESSAGE.ACCOUNT_DISABLED);
    }
    // 动态码 / 恢复码校验（内部已是常量时间比较；失败抛 401）
    await this.mfaService.verifyLoginCode(Number(user.id), code);

    const location = await this.ipRegion.locate(ip);
    await this.writeLoginLog(user.username, ip, userAgent, LogResult.SUCCESS, '登录成功（二次验证）', location);
    return this.issueTokens(user, ip, userAgent, location);
  }

  /** 登录末段：登记会话并签发双 Token（MFA 分支与非 MFA 分支共用）。 */
  private async issueTokens(
    user: {
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
      mustChangePassword: number;
      dept?: { deptName: string } | null;
    },
    ip: string,
    userAgent: string,
    location: string,
  ): Promise<LoginResult> {
    const payload = { userId: Number(user.id), username: user.username };
    // 登记在线会话：成功后令牌带上 sid（可被在线用户页强制下线）；
    // Redis 不可用时 create 返回 null，此时签发不带 sid 的令牌——宁可失去会话管理能力，
    // 也不能出现「令牌带着 sid 但会话没登记 → 拿回 Redis 后立刻 401」。
    const sid =
      (await this.sessionService.create({
        userId: Number(user.id),
        username: user.username,
        nickname: user.nickname,
        ip,
        location,
        userAgent: userAgent.slice(0, 500),
      })) ?? undefined;

    return {
      accessToken: await this.jwtService.signAccessToken(payload, sid),
      refreshToken: await this.jwtService.signRefreshToken(payload, sid),
      user: this.toUserBrief({ ...user, dept: await this.deptRef(user.deptId) }),
      // 初始口令治理：被置位的账号登录后前端强制改密，杜绝「123456 上生产」的事故
      mustChangePassword: Number(user.mustChangePassword) === 1,
    };
  }

  /**
   * 登录时的设备并发控制。
   *
   * 策略（优先级从高到低）：
   * ① 用户单独设置 `sys_user.max_devices`（NULL = 未单独设置，0 = 不限制）；
   * ② 角色层：命中豁免名单 `sys.login.guestRoleCodes` → 不限制；否则取用户各角色
   *    `sys_role.max_devices` 已设置值——0 = 不限制（且不参与收紧），正值取最小（最严格），
   *    角色都未设置才进入下一级；
   * ③ 全局参数 `sys.login.maxDevices`（0 = 不限制，缺失/非法回退默认 3）；
   * 新登录会先回收「最旧」的会话腾出名额（新设备顺利进入，旧设备下一次请求即失效），
   * 命中 `sys.login.guestRoleCodes` 的角色（如只读访客 viewer）完全豁免，允许多设备同时在线。
   *
   * 降级：Redis 不可用（本就不登记会话）、参数读取失败一律放行——
   * 设备控制是安全增强，绝不能成为登录失败的诱因。
   */
  private async applyDeviceLimit(user: {
    id: bigint;
    username: string;
    /** 单用户设备上限：非空且 >=0 时优先（0 = 不限制） */
    maxDevices?: number | null;
    userRoles?: Array<{ role: { roleCode: string; maxDevices?: number | null } }>;
  }): Promise<void> {
    if (!this.redis.isReady()) {
      return;
    }
    try {
      // 优先级：用户单独设置 > 角色层（豁免名单 → 角色 maxDevices）> 全局参数 sys.login.maxDevices
      const userLimit = user.maxDevices === null || user.maxDevices === undefined ? null : Number(user.maxDevices);
      let maxDevices: number;
      if (userLimit !== null && userLimit >= 0) {
        maxDevices = userLimit;
      } else {
        const [limitRow, guestRow] = await Promise.all([
          this.configService.getConfigData(MAX_DEVICES_CONFIG_KEY),
          this.configService.getConfigData(GUEST_ROLE_CONFIG_KEY),
        ]);
        const roles = user.userRoles ?? [];
        const roleCodes = roles.map((link) => link.role.roleCode);
        if (roleCodes.some((code) => parseCodeList(guestRow?.configValue).includes(code))) {
          // 豁免名单：不限制并发登录
          return;
        }
        // 角色层：已设置 maxDevices 的角色；0=不限制但不参与收紧，正值取最小（最严格）
        const roleLimits = roles
          .map((link) => link.role.maxDevices)
          .filter((value): value is number => value !== null && value !== undefined)
          .map(Number)
          .filter((value) => value >= 0);
        const positiveLimits = roleLimits.filter((value) => value > 0);
        if (roleLimits.length > 0) {
          maxDevices = positiveLimits.length > 0 ? Math.min(...positiveLimits) : 0;
        } else {
          maxDevices = parseMaxDevices(limitRow?.configValue);
        }
      }
      if (maxDevices <= 0) {
        return;
      }
      const evicted = await this.sessionService.enforceDeviceLimit(Number(user.id), maxDevices);
      if (evicted.length === 0) {
        return;
      }
      this.logger.warn(
        `[AuthService] 设备上限 ${maxDevices}：${user.username} 的 ${evicted.length} 台旧会话被回收` +
          `（${evicted.map((session) => session.ip || '未知 IP').join('、')}）`,
      );
      // 被回收设备的人应当收到提醒：给他留一条安全通知（publish 内部吞异常，不影响登录）
      await this.noticeService.publish({
        title: '登录设备数已达上限',
        content:
          `你在新设备登录时，较早的登录会话（${evicted.map((session) => session.ip || '未知 IP').join('、')}）` +
          '已被自动下线。如非本人操作，请及时修改密码。',
        noticeType: NOTICE_TYPE.SECURITY,
        userIds: [...new Set(evicted.map((session) => session.userId))],
        createdBy: null,
      });
    } catch (error) {
      this.logger.error(
        `[AuthService] 设备并发控制失败（不影响本次登录）: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

    // 会话已被强制下线：连刷新也不放行（否则下线只挡住了 access，客户端刷新即可复活）
    if (payload.sid && this.redis.isReady() && !(await this.sessionService.isAlive(payload.sid))) {
      throw AppException.unauthorized(ERROR_MESSAGE.SESSION_REVOKED);
    }
    if (payload.sid) {
      // 刷新即活跃：顺带延长会话 TTL，让长期在用的会话不会「令牌还能刷、会话却过期」
      await this.sessionService.touch(payload.sid);
    }

    const nextPayload = { userId: Number(user.id), username: user.username };
    // 刷新沿用同一个会话 id：会话身份是"一次登录"，不因刷新而分裂
    return {
      accessToken: await this.jwtService.signAccessToken(nextPayload, payload.sid),
      refreshToken: await this.jwtService.signRefreshToken(nextPayload, payload.sid),
    };
  }

  /**
   * 获取当前用户信息（用户 + 角色码 + 权限码）。
   * 传入鉴权中间件已加载的上下文可避免重复查库。
   */
  async getProfile(
    userId: number,
    context?: AuthContext | null,
  ): Promise<{ user: UserBrief; roles: string[]; permissions: string[]; mustChangePassword: boolean }> {
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
      // 刷新页面后前端据此恢复「强制改密」拦截（登录响应只在新登录时下发一次）
      mustChangePassword: Number(user.mustChangePassword) === 1,
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
  async logout(userId: number, sid?: string): Promise<void> {
    await this.blacklist.recordLogout(userId);
    // 主动登出：把会话记录一并摘掉，在线用户列表立即少一条（用户级黑名单负责令牌失效）
    if (sid) {
      await this.sessionService.remove(sid, userId);
    }
  }
}
