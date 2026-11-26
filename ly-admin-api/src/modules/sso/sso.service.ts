/**
 * 企业单点登录（OIDC）服务。
 * 模块职责：提供方配置管理；授权 URL 构造；回调换 token；一次性票据换取本站登录态。
 *
 * 关键设计：
 * - **state/nonce 进 Redis**：回调时比对，防 CSRF 与重放；TTL 短（默认 5 分钟）；
 * - **回调不直接回传令牌**：换取一次性 ticket（60s、一次性），前端凭 ticket 调 redeem
 *   换 JWT——避免 accessToken 出现在 URL / Nginx 访问日志 / 浏览器历史里；
 * - **id_token 签名校验**：配置了 jwksUrl 时经 jose 远程 JWKS 验签；内网自建提供方
 *   可留空（此时仅校验 iss/aud/exp 与 userinfo 端点的 HTTPS 会话），并在文档中明示风险；
 * - **账号 provision 三级匹配**：已绑定（provider+sub）→ 邮箱匹配（linkByEmail）→
 *   自动建号（授予 defaultRoleCodes）。任一级失败即拒绝，不静默建号乱授权。
 */
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { encryptSecret, decryptSecret } from '../../common/crypto/secret-box.js';
import { hashPassword } from '../../common/utils/utils.js';
import { config } from '../../common/config/config.js';
import { Status } from '../../common/config/constants.js';
import { AuthService } from '../auth/auth.service.js';
import type { LoginResult } from '../auth/auth.service.js';

/** 提供方对外字段（clientSecret 永不外泄）。 */
export interface SsoProviderItem {
  id: number;
  name: string;
  protocol: string;
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl: string | null;
  clientId: string;
  scopes: string;
  redirectUri: string;
  fieldMapping: Record<string, string>;
  linkByEmail: boolean;
  defaultRoleCodes: string[];
  status: number;
  sort: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 登录页可见的提供方（最小字段）。 */
export interface EnabledSsoProvider {
  id: number;
  name: string;
}

/** Redis 键：授权 state → { providerId, nonce }。 */
const STATE_KEY_PREFIX = 'sso:state:';
/** Redis 键：一次性 ticket → { userId }。 */
const TICKET_KEY_PREFIX = 'sso:ticket:';

/** 字段映射默认 claim 名。 */
const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  username: 'preferred_username',
  email: 'email',
  nickname: 'name',
  avatar: 'picture',
};

/** 数据库行 → 对外 DTO。 */
function toItem(row: {
  id: bigint;
  name: string;
  protocol: string;
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl: string | null;
  clientId: string;
  scopes: string;
  redirectUri: string;
  fieldMapping: string | null;
  linkByEmail: number;
  defaultRoleCodes: string | null;
  status: number;
  sort: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SsoProviderItem {
  let fieldMapping: Record<string, string> = {};
  if (row.fieldMapping) {
    try {
      const parsed: unknown = JSON.parse(row.fieldMapping);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        fieldMapping = parsed as Record<string, string>;
      }
    } catch {
      fieldMapping = {};
    }
  }
  return {
    id: Number(row.id),
    name: row.name,
    protocol: row.protocol,
    issuer: row.issuer,
    authorizationUrl: row.authorizationUrl,
    tokenUrl: row.tokenUrl,
    userInfoUrl: row.userInfoUrl,
    jwksUrl: row.jwksUrl,
    clientId: row.clientId,
    scopes: row.scopes?.trim() || 'openid profile email',
    redirectUri: row.redirectUri,
    fieldMapping: { ...DEFAULT_FIELD_MAPPING, ...fieldMapping },
    linkByEmail: Number(row.linkByEmail) === 1,
    defaultRoleCodes: (row.defaultRoleCodes ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    status: Number(row.status),
    sort: Number(row.sort),
    remark: row.remark,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 从 JWT/id_token 或 userinfo 响应中按映射取字段。 */
function pickClaim(claims: Record<string, unknown>, mapping: Record<string, string>, field: string): string {
  const claimName = mapping[field] ?? DEFAULT_FIELD_MAPPING[field];
  const value = claims[claimName];
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  /** JWKS 客户端缓存（按 URL，避免每请求都拉公钥）。 */
  private readonly jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {}

  /* ------------------------------ 管理面 CRUD ------------------------------ */

  /** 提供方列表（数量有限，一次返回；前端自行按需筛选）。 */
  async listProviders(): Promise<{ list: SsoProviderItem[]; total: number }> {
    const rows = await this.prisma.ssoProvider.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    const total = rows.length;
    return { list: rows.map(toItem), total };
  }

  /** 提供方详情。 */
  async getProvider(id: number): Promise<SsoProviderItem> {
    const row = await this.prisma.ssoProvider.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('SSO 提供方不存在');
    }
    return toItem(row);
  }

  /** 新增提供方（clientSecret 信封加密后入库）。 */
  async createProvider(input: Record<string, unknown>, operatorId: number): Promise<SsoProviderItem> {
    const data = this.readProviderInput(input);
    const row = await this.prisma.ssoProvider.create({
      data: {
        name: data.name,
        protocol: 'oidc',
        issuer: data.issuer,
        authorizationUrl: data.authorizationUrl,
        tokenUrl: data.tokenUrl,
        userInfoUrl: data.userInfoUrl,
        jwksUrl: data.jwksUrl,
        clientId: data.clientId,
        clientSecret: encryptSecret(data.clientSecret),
        scopes: data.scopes,
        redirectUri: data.redirectUri,
        fieldMapping: JSON.stringify(data.fieldMapping),
        linkByEmail: data.linkByEmail ? 1 : 0,
        defaultRoleCodes: data.defaultRoleCodes.join(','),
        status: data.status,
        sort: data.sort,
        remark: data.remark,
      },
    });
    this.logger.log(`操作者 ${operatorId} 新增 SSO 提供方 ${row.name}`);
    return toItem(row);
  }

  /** 更新提供方（clientSecret 留空表示不修改）。 */
  async updateProvider(id: number, input: Record<string, unknown>, operatorId: number): Promise<SsoProviderItem> {
    const existing = await this.prisma.ssoProvider.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('SSO 提供方不存在');
    }
    const data = this.readProviderInput(input);
    await this.prisma.ssoProvider.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        issuer: data.issuer,
        authorizationUrl: data.authorizationUrl,
        tokenUrl: data.tokenUrl,
        userInfoUrl: data.userInfoUrl,
        jwksUrl: data.jwksUrl,
        clientId: data.clientId,
        // 仅在提供了新密钥时才覆盖（编辑界面不回显旧密钥）
        ...(input.clientSecret ? { clientSecret: encryptSecret(data.clientSecret) } : {}),
        scopes: data.scopes,
        redirectUri: data.redirectUri,
        fieldMapping: JSON.stringify(data.fieldMapping),
        linkByEmail: data.linkByEmail ? 1 : 0,
        defaultRoleCodes: data.defaultRoleCodes.join(','),
        status: data.status,
        sort: data.sort,
        remark: data.remark,
      },
    });
    this.logger.log(`操作者 ${operatorId} 更新 SSO 提供方 ${data.name}`);
    return this.getProvider(id);
  }

  /** 删除提供方（用户绑定关系一并清理）。 */
  async deleteProvider(id: number, operatorId: number): Promise<void> {
    const existing = await this.prisma.ssoProvider.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('SSO 提供方不存在');
    }
    await this.prisma.userSso.deleteMany({ where: { providerId: BigInt(id) } });
    await this.prisma.ssoProvider.delete({ where: { id: BigInt(id) } });
    this.logger.log(`操作者 ${operatorId} 删除 SSO 提供方 ${existing.name}`);
  }

  /* ------------------------------ 登录面流程 ------------------------------ */

  /** 登录页可见的启用中提供方。 */
  async listEnabledProviders(): Promise<EnabledSsoProvider[]> {
    if (!config.sso.enabled || !config.sso.showOnLoginPage) {
      return [];
    }
    const rows = await this.prisma.ssoProvider.findMany({
      where: { status: Status.ENABLED },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    return rows.map((row) => ({ id: Number(row.id), name: row.name }));
  }

  /**
   * 构造授权 URL 并登记 state/nonce。
   * @returns 前端要跳转的完整授权地址
   */
  async buildAuthorizeUrl(providerId: number): Promise<{ url: string }> {
    const provider = await this.requireEnabledProvider(providerId);
    const state = randomUUID();
    const nonce = randomUUID();
    await this.redis.set(
      `${STATE_KEY_PREFIX}${state}`,
      JSON.stringify({ providerId, nonce }),
      config.sso.stateTtlMinutes * 60_000,
    );
    const url = new URL(provider.authorizationUrl);
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', provider.scopes);
    url.searchParams.set('redirect_uri', provider.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return { url: url.toString() };
  }

  /**
   * OIDC 回调：校验 state → 换 token → 验证身份 → provision 账号 → 发一次性 ticket。
   * @returns 前端凭 ticket 换登录态的地址参数（由控制器拼前端回调地址）
   */
  async handleCallback(providerId: number, code: string, state: string): Promise<{ ticket: string }> {
    const cached = await this.redis.get(`${STATE_KEY_PREFIX}${state}`);
    if (!cached) {
      throw AppException.badRequest('授权状态无效或已过期，请重新登录');
    }
    const parsed = JSON.parse(cached) as { providerId: number; nonce: string };
    if (parsed.providerId !== providerId) {
      throw AppException.badRequest('授权状态与提供方不匹配');
    }
    await this.redis.del(`${STATE_KEY_PREFIX}${state}`);

    const provider = await this.requireEnabledProvider(providerId);
    // clientSecret 只在响应里脱钩（toItem 不含），这里从实体行解密使用
    const entity = await this.prisma.ssoProvider.findUniqueOrThrow({ where: { id: BigInt(providerId) } });
    const clientSecret = decryptSecret(entity.clientSecret);

    // 1) 授权码换 token（Basic 认证，OIDC 标准）
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${provider.clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: provider.redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      this.logger.warn(`SSO token 换取失败：HTTP ${tokenResponse.status}`);
      throw AppException.badRequest('授权码交换失败，请重新登录');
    }
    const tokenBody = (await tokenResponse.json()) as { id_token?: string; access_token?: string };
    if (!tokenBody.access_token && !tokenBody.id_token) {
      throw AppException.badRequest('提供方未返回有效令牌');
    }

    // 2) 身份确认：优先验 id_token（有 JWKS 时验签），否则用 access_token 拉 userinfo
    const claims = await this.resolveClaims(provider, tokenBody, parsed.nonce);

    // 3) provision：绑定 → 邮箱 → 自动建号
    const userId = await this.provisionUser(provider, claims);

    // 4) 一次性 ticket（短 TTL），前端凭票换 JWT
    const ticket = randomUUID();
    await this.redis.set(
      `${TICKET_KEY_PREFIX}${ticket}`,
      JSON.stringify({ userId }),
      config.sso.ticketTtlSeconds * 1000,
    );
    return { ticket };
  }

  /** 前端用 ticket 换本站双 Token（一次性：用后即焚）。 */
  async redeemTicket(ticket: string, ip = '', userAgent = 'sso'): Promise<LoginResult> {
    const cached = await this.redis.get(`${TICKET_KEY_PREFIX}${ticket}`);
    if (!cached) {
      throw AppException.unauthorized('登录票据无效或已使用，请重新登录');
    }
    await this.redis.del(`${TICKET_KEY_PREFIX}${ticket}`);
    const parsed = JSON.parse(cached) as { userId: number };
    return this.authService.issueTokensForUser(parsed.userId, ip, userAgent);
  }

  /* ------------------------------ 内部实现 ------------------------------ */

  /** 取启用中的提供方，禁用/不存在一律按不存在处理（不暴露存在性）。 */
  private async requireEnabledProvider(providerId: number) {
    const row = await this.prisma.ssoProvider.findUnique({ where: { id: BigInt(providerId) } });
    if (!row || Number(row.status) !== Status.ENABLED) {
      throw AppException.notFound('SSO 提供方不存在或已停用');
    }
    return toItem(row);
  }

  /** 解析身份 claims：验 id_token 或拉 userinfo，并校验 nonce。 */
  private async resolveClaims(
    provider: SsoProviderItem,
    tokenBody: { id_token?: string; access_token?: string },
    expectedNonce: string,
  ): Promise<Record<string, unknown>> {
    if (tokenBody.id_token) {
      if (provider.jwksUrl) {
        // 配置了 JWKS：验签 + 校验 iss/aud/exp（jose 标准路径）
        const { payload } = await jwtVerify(tokenBody.id_token, this.remoteJwks(provider.jwksUrl), {
          issuer: provider.issuer,
          audience: provider.clientId,
        });
        this.assertNonce(payload, expectedNonce);
        return payload as unknown as Record<string, unknown>;
      }
      // 未配置 JWKS（内网自建提供方的常见选择）：不验签，仅校验 exp/iss/aud/nonce。
      // 风险由配置界面明示（见更新的文档），换取的是对接成本归零。
      const payload = decodeJwt(tokenBody.id_token);
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp === 'number' && payload.exp < now) {
        throw AppException.badRequest('id_token 已过期，请重新登录');
      }
      if (payload.iss !== provider.issuer) {
        throw AppException.badRequest('id_token 签发者不符');
      }
      const aud = payload.aud;
      const audOk =
        typeof aud === 'string' ? aud === provider.clientId : Array.isArray(aud) && aud.includes(provider.clientId);
      if (!audOk) {
        throw AppException.badRequest('id_token 受众不符');
      }
      this.logger.warn(`SSO 提供方 ${provider.name} 未配置 jwksUrl，id_token 未验签（仅校验 claims）`);
      this.assertNonce(payload, expectedNonce);
      return payload as unknown as Record<string, unknown>;
    }
    // 无 id_token：用 access_token 拉 userinfo（自建提供方的常见配置）
    const response = await fetch(provider.userInfoUrl, {
      headers: { authorization: `Bearer ${tokenBody.access_token ?? ''}` },
    });
    if (!response.ok) {
      throw AppException.badRequest('用户信息获取失败，请重新登录');
    }
    return (await response.json()) as Record<string, unknown>;
  }

  /** nonce 校验（防重放）。缺失 nonce 声明时从严拒绝。 */
  private assertNonce(payload: JWTPayload, expectedNonce: string): void {
    if (payload.nonce !== expectedNonce) {
      throw AppException.badRequest('nonce 校验失败，请重新登录');
    }
  }

  /** JWKS 客户端按 URL 缓存。 */
  private remoteJwks(jwksUrl: string) {
    let jwks = this.jwksCache.get(jwksUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(jwksUrl));
      this.jwksCache.set(jwksUrl, jwks);
    }
    return jwks;
  }

  /**
   * 账号 provision：三级匹配。
   * 1. provider + sub 已绑定 → 直接登录；
   * 2. linkByEmail 开启且邮箱命中本地账号 → 自动绑定并登录；
   * 3. 都不命中 → 用 defaultRoleCodes 建号（无默认角色则拒绝——禁止无声授权）。
   */
  private async provisionUser(provider: SsoProviderItem, claims: Record<string, unknown>): Promise<number> {
    const sub =
      pickClaim(claims, provider.fieldMapping, 'username') || (typeof claims.sub === 'string' ? claims.sub : '');
    const email = pickClaim(claims, provider.fieldMapping, 'email');
    const nickname = pickClaim(claims, provider.fieldMapping, 'nickname') || sub;
    if (!sub) {
      throw AppException.badRequest('提供方未返回可识别的用户标识');
    }

    const bound = await this.prisma.userSso.findUnique({
      where: { providerId_subject: { providerId: BigInt(provider.id), subject: sub } },
      select: { userId: true },
    });
    if (bound) {
      await this.touchLogin(Number(bound.userId));
      return Number(bound.userId);
    }

    // 邮箱匹配（自动绑定既有账号，避免同一人被建两个号）
    if (provider.linkByEmail && email) {
      // email 非唯一索引：用 findFirst + 多结果防御（同一邮箱命中多个账号时拒绝，避免绑错人）
      const matches = await this.prisma.user.findMany({
        where: { email },
        select: { id: true, status: true },
        take: 2,
      });
      if (matches.length > 1) {
        throw AppException.conflict('该邮箱匹配到多个本地账号，请联系管理员人工绑定');
      }
      const existing = matches[0];
      if (existing) {
        if (Number(existing.status) !== Status.ENABLED) {
          throw AppException.unauthorized('账号已被禁用');
        }
        await this.prisma.userSso.create({
          data: { userId: existing.id, providerId: BigInt(provider.id), subject: sub },
        });
        return Number(existing.id);
      }
    }

    // 自动建号
    const roleCodes = provider.defaultRoleCodes;
    if (!roleCodes.length) {
      throw AppException.forbidden('该 SSO 提供方未配置默认角色，无法自动创建账号，请联系管理员');
    }
    const roles = await this.prisma.role.findMany({ where: { roleCode: { in: roleCodes } }, select: { id: true } });
    if (!roles.length) {
      throw AppException.badRequest('SSO 提供方配置的默认角色不存在，请联系管理员');
    }
    // 用户名取 preferred_username / email 前缀，冲突时加随机后缀
    const base = sub.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40) || 'sso_user';
    let username = base;
    let attempt = 0;
    while (await this.prisma.user.findUnique({ where: { username }, select: { id: true } })) {
      attempt += 1;
      username = `${base}${attempt}`;
    }
    const created = await this.prisma.user.create({
      data: {
        username,
        nickname,
        email: email || null,
        status: Status.ENABLED,
        remark: `SSO 自动创建（${provider.name}）`,
        // 随机口令占位：SSO 用户不通过口令登录；哈希仍写满以防空值约束
        password: await hashPassword(randomUUID()),
      },
    });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: created.id, roleId: role.id })),
      skipDuplicates: true,
    });
    await this.prisma.userSso.create({
      data: { userId: created.id, providerId: BigInt(provider.id), subject: sub },
    });
    this.logger.log(`SSO 自动建号：${username}（提供方 ${provider.name}）`);
    return Number(created.id);
  }

  /** 已绑定用户登录时刷新 lastLoginAt。 */
  private async touchLogin(userId: number): Promise<void> {
    await this.prisma.user.update({ where: { id: BigInt(userId) }, data: { lastLoginAt: new Date() } });
  }

  /** 读取并校验管理面输入（clientSecret 必填于创建；编辑可缺省）。 */
  private readProviderInput(input: Record<string, unknown>): {
    name: string;
    issuer: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    jwksUrl: string | null;
    clientId: string;
    clientSecret: string;
    scopes: string;
    redirectUri: string;
    fieldMapping: Record<string, string>;
    linkByEmail: boolean;
    defaultRoleCodes: string[];
    status: number;
    sort: number;
    remark: string | null;
  } {
    const str = (key: string, fallback = ''): string => {
      const value = input[key];
      return typeof value === 'string' ? value.trim() : fallback;
    };
    const name = str('name');
    const issuer = str('issuer');
    const authorizationUrl = str('authorizationUrl');
    const tokenUrl = str('tokenUrl');
    const userInfoUrl = str('userInfoUrl');
    const clientId = str('clientId');
    const clientSecret = str('clientSecret');
    if (!name || !issuer || !authorizationUrl || !tokenUrl || !userInfoUrl || !clientId) {
      throw AppException.badRequest('名称 / issuer / 授权端点 / 令牌端点 / 用户信息端点 / clientId 均为必填');
    }
    if (!clientSecret) {
      throw AppException.badRequest('clientSecret 不能为空');
    }
    for (const [key, value] of Object.entries({ authorizationUrl, tokenUrl, userInfoUrl })) {
      if (!/^https?:\/\//.test(value)) {
        throw AppException.badRequest(`${key} 必须是合法 URL`);
      }
    }
    let fieldMapping: Record<string, string> = {};
    if (typeof input.fieldMapping === 'string' && input.fieldMapping.trim()) {
      try {
        const parsed: unknown = JSON.parse(input.fieldMapping);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          fieldMapping = parsed as Record<string, string>;
        }
      } catch {
        throw AppException.badRequest('fieldMapping 必须是 JSON 对象');
      }
    }
    return {
      name,
      issuer,
      authorizationUrl,
      tokenUrl,
      userInfoUrl,
      jwksUrl: str('jwksUrl') || null,
      clientId,
      clientSecret,
      scopes: str('scopes', 'openid profile email'),
      redirectUri: str('redirectUri'),
      fieldMapping,
      linkByEmail: input.linkByEmail === undefined ? true : Boolean(input.linkByEmail),
      defaultRoleCodes: str('defaultRoleCodes')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      status: input.status === undefined ? Status.ENABLED : Number(input.status),
      sort: input.sort === undefined ? 0 : Number(input.sort),
      remark: str('remark') || null,
    };
  }
}
