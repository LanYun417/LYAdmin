/**
 * LDAP 目录认证服务。
 * 模块职责：配置管理（单例）、连接测试、用户认证（bind → 搜索 → 用户 bind 验密）、
 * 账号供给（本地已存在直接登录，不存在按 defaultRoleCodes 自动建号）。
 *
 * 安全口径：
 * - 服务账号口令信封加密（与 MFA / SSO / 告警同一把钥匙 SECRETS_ENCRYPTION_KEY）；
 * - 过滤器模板做注入防护：{{username}} 之外的字符只允许 RFC 4515 过滤器字符，
 *   拼装前对占位符值做 LDAP 过滤字符转义，防 `(uid=*)(uid=*)` 类绕过；
 * - 用户 bind 用「搜索到的真实 DN + 用户输入口令」——口令不过服务账号、不落日志；
 * - TLS 证书校验默认开启；`verifyCert=false` 仅建议内网自签场景。
 */
import { Injectable, Logger } from '@nestjs/common';
import type { Client } from 'ldapjs';
import ldap from 'ldapjs';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { encryptSecret, decryptSecret, secretsEncryptionAvailable } from '../../common/crypto/secret-box.js';
import { Status } from '../../common/config/constants.js';
import { hashPassword } from '../../common/utils/utils.js';

/** 单例主键（与 schema 约定一致）。 */
const SINGLETON_ID = 1;

/** 连接超时（毫秒）：LDAP 服务器不可达时快速失败，不拖住登录请求。 */
const CONNECT_TIMEOUT_MS = 5000;

/**
 * 过滤器模板校验：抽出 {{username}} 占位符后，剩余部分只允许 RFC 4515 过滤器字符。
 * 占位符必须恰好出现一次（0 次或多次都拒绝）；反斜杠/方括号/裸花括号不放行，
 * 避免 \28 这类转义序列本身成为注入载体。
 */
function isValidFilterTemplate(filter: string): boolean {
  const placeholder = '{{username}}';
  const first = filter.indexOf(placeholder);
  if (first < 0 || filter.indexOf(placeholder, first + placeholder.length) >= 0) {
    return false;
  }
  const before = filter.slice(0, first);
  const after = filter.slice(first + placeholder.length);
  // 占位符前：允许属性与开括号（如 `(uid=`、`(&(objectClass=person)(uid=`）；
  // 占位符后：**只允许闭合**（`)`），不允许再出现 `(` / `&` / `|` 改写查询结构——
  // 否则 `(uid={{username}})(|(x))` 这类过滤器炸弹会绕过白名单。
  return /^[A-Za-z0-9_\s()=&|!~*<>:,.\-'"()[\]]*$/.test(before) && /^\)*$/.test(after);
}

/** 脱敏输出的配置视图。 */
export interface LdapConfigView {
  enabled: boolean;
  url: string;
  startTls: boolean;
  verifyCert: boolean;
  bindDn: string;
  /** 始终为 true/false——是否已设置口令，绝不回传真值 */
  hasPassword: boolean;
  baseDn: string;
  userFilter: string;
  usernameAttr: string;
  emailAttr: string | null;
  nicknameAttr: string | null;
  defaultRoleCodes: string;
  updatedAt: Date | null;
}

/** 认证成功的用户属性。 */
export interface LdapUserInfo {
  /** 目录内的唯一标识（映射后的本地账号名） */
  username: string;
  email: string | null;
  nickname: string | null;
  /** 搜索命中的真实 DN（用户 bind 用） */
  dn: string;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 功能是否可用（未配信封密钥时口令无法安全落库 → 禁用）。 */
  isEnabled(): boolean {
    return secretsEncryptionAvailable();
  }

  /* -------------------------------- 配置管理 -------------------------------- */

  /** 读取配置视图（未初始化时返回「未配置 + 停用」的默认视图）。 */
  async getConfig(): Promise<LdapConfigView> {
    const row = await this.prisma.ldapConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) {
      return {
        enabled: false,
        url: '',
        startTls: false,
        verifyCert: true,
        bindDn: '',
        hasPassword: false,
        baseDn: '',
        userFilter: '(uid={{username}})',
        usernameAttr: 'uid',
        emailAttr: null,
        nicknameAttr: null,
        defaultRoleCodes: '',
        updatedAt: null,
      };
    }
    return {
      enabled: row.enabled,
      url: row.url,
      startTls: row.startTls,
      verifyCert: row.verifyCert,
      bindDn: row.bindDn,
      hasPassword: Boolean(row.bindPassword),
      baseDn: row.baseDn,
      userFilter: row.userFilter,
      usernameAttr: row.usernameAttr,
      emailAttr: row.emailAttr,
      nicknameAttr: row.nicknameAttr,
      defaultRoleCodes: row.defaultRoleCodes ?? '',
      updatedAt: row.updatedAt,
    };
  }

  /**
   * 保存配置（upsert 单例）。
   * @param input.bindPassword 留空 = 不修改原口令（编辑时不要求重填）
   */
  async saveConfig(input: {
    enabled: boolean;
    url: string;
    startTls?: boolean;
    verifyCert?: boolean;
    bindDn: string;
    bindPassword?: string;
    baseDn: string;
    userFilter?: string;
    usernameAttr?: string;
    emailAttr?: string | null;
    nicknameAttr?: string | null;
    defaultRoleCodes?: string;
  }): Promise<LdapConfigView> {
    this.assertConfigInput(input);
    const password = input.bindPassword?.trim();
    await this.prisma.ldapConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {
        enabled: input.enabled,
        url: input.url.trim(),
        startTls: input.startTls ?? false,
        verifyCert: input.verifyCert ?? true,
        bindDn: input.bindDn.trim(),
        // 口令留空保留原密文；提供了新值才覆盖（信封加密）
        ...(password ? { bindPassword: encryptSecret(password) } : {}),
        baseDn: input.baseDn.trim(),
        userFilter: input.userFilter?.trim() || '(uid={{username}})',
        usernameAttr: input.usernameAttr?.trim() || 'uid',
        emailAttr: input.emailAttr?.trim() || null,
        nicknameAttr: input.nicknameAttr?.trim() || null,
        defaultRoleCodes: input.defaultRoleCodes?.trim() || null,
      },
      create: {
        id: SINGLETON_ID,
        enabled: input.enabled,
        url: input.url.trim(),
        startTls: input.startTls ?? false,
        verifyCert: input.verifyCert ?? true,
        bindDn: input.bindDn.trim(),
        bindPassword: password ? encryptSecret(password) : '',
        baseDn: input.baseDn.trim(),
        userFilter: input.userFilter?.trim() || '(uid={{username}})',
        usernameAttr: input.usernameAttr?.trim() || 'uid',
        emailAttr: input.emailAttr?.trim() || null,
        nicknameAttr: input.nicknameAttr?.trim() || null,
        defaultRoleCodes: input.defaultRoleCodes?.trim() || null,
      },
    });
    this.logger.log(`LDAP 配置已保存（enabled=${input.enabled}）`);
    return this.getConfig();
  }

  /** 必填与格式校验（保存前 fail-fast）。 */
  private assertConfigInput(input: { url: string; bindDn: string; baseDn: string; userFilter?: string }): void {
    if (!input.url?.trim()) {
      throw AppException.badRequest('服务器地址不能为空');
    }
    if (!/^ldaps?:\/\//.test(input.url.trim())) {
      throw AppException.badRequest('服务器地址必须以 ldap:// 或 ldaps:// 开头');
    }
    if (!input.bindDn?.trim()) {
      throw AppException.badRequest('服务账号 DN 不能为空');
    }
    if (!input.baseDn?.trim()) {
      throw AppException.badRequest('用户搜索基准 DN 不能为空');
    }
    const filter = input.userFilter ?? '(uid={{username}})';
    if (!filter.includes('{{username}}')) {
      throw AppException.badRequest('用户搜索过滤器必须包含 {{username}} 占位符');
    }
    if (!isValidFilterTemplate(filter)) {
      throw AppException.badRequest('用户搜索过滤器含非法字符');
    }
  }

  /** 测试连接：以服务账号 bind + 一次匿名搜索，验证凭据与基准 DN 可达。 */
  async testConnection(input?: {
    url?: string;
    bindDn?: string;
    bindPassword?: string;
    baseDn?: string;
    verifyCert?: boolean;
    startTls?: boolean;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      // 传入参数为空时用已保存配置（「测试当前配置」）
      const saved = await this.prisma.ldapConfig.findUnique({ where: { id: SINGLETON_ID } });
      if (!saved && !input?.url) {
        return { ok: false, message: '尚未保存配置，无法测试' };
      }
      const url = (input?.url ?? saved?.url ?? '').trim();
      const bindDn = (input?.bindDn ?? saved?.bindDn ?? '').trim();
      const baseDn = (input?.baseDn ?? saved?.baseDn ?? '').trim();
      const password = input?.bindPassword?.trim() ?? (saved?.bindPassword ? decryptSecret(saved.bindPassword) : '');
      if (!url || !bindDn || !password) {
        return { ok: false, message: '配置不完整：需要 url / bindDn / bindPassword' };
      }
      const client = this.createClient({
        url,
        verifyCert: input?.verifyCert ?? saved?.verifyCert ?? true,
        startTls: input?.startTls ?? saved?.startTls ?? false,
      });
      try {
        await this.bind(client, bindDn, password);
        // 基准 DN 下一层搜索（limit 1）：验证 baseDn 可读
        const entries = await this.search(client, baseDn, { scope: 'base', filter: '(objectClass=*)', sizeLimit: 1 });
        return { ok: true, message: entries.length > 0 ? '连接成功，基准 DN 可读' : '连接成功（服务账号可绑定）' };
      } finally {
        client.unbind();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`LDAP 连接测试失败：${message}`);
      return { ok: false, message };
    }
  }

  /* -------------------------------- 认证 -------------------------------- */

  /**
   * 用 LDAP 认证用户（登录链路 fallback）。
   * @param username 用户输入的账号（对应 usernameAttr 的属性值）
   * @param password 用户输入的口令
   * @returns 认证成功返回属性；失败返回 null（调用方按「认证失败」处理）
   */
  async authenticate(username: string, password: string): Promise<LdapUserInfo | null> {
    const row = await this.prisma.ldapConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (!row || !row.enabled || !row.bindPassword) {
      return null; // 未配置/未启用：调用方走本地口令
    }
    if (!username || !password) {
      return null;
    }
    const escaped = escapeFilterValue(username);
    const filter = row.userFilter.replace('{{username}}', escaped);
    const client = this.createClient({
      url: row.url,
      verifyCert: row.verifyCert,
      startTls: row.startTls,
    });
    try {
      // 1) 服务账号 bind（搜索权限）
      await this.bind(client, row.bindDn, decryptSecret(row.bindPassword));
      // 2) 搜索用户（subtree 范围，limit 2：撞车说明过滤器不够精确，拒绝而非猜一个）
      const entries = await this.search(client, row.baseDn, {
        scope: 'sub',
        filter,
        sizeLimit: 2,
        attributes: [
          row.usernameAttr,
          ...(row.emailAttr ? [row.emailAttr] : []),
          ...(row.nicknameAttr ? [row.nicknameAttr] : []),
        ],
      });
      if (entries.length === 0) {
        return null;
      }
      if (entries.length > 1) {
        this.logger.warn('LDAP 搜索命中多条记录，已拒绝认证（过滤器需更精确）');
        return null;
      }
      const entry = entries[0];
      const ldapUsername = this.pickAttr(entry, row.usernameAttr) || username;
      // 3) 以「用户 DN + 用户口令」bind：口令正确才成功
      await this.bind(client, entry.dn.toString(), password);
      return {
        username: ldapUsername,
        email: row.emailAttr ? this.pickAttr(entry, row.emailAttr) : null,
        nickname: row.nicknameAttr ? this.pickAttr(entry, row.nicknameAttr) : null,
        dn: entry.dn.toString(),
      };
    } catch (error) {
      // 口令错的 bind 会抛错——按「认证失败」处理，不向上抛（登录链路统一口径）
      this.logger.warn(`LDAP 认证失败（${username}）：${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      client.unbind();
    }
  }

  /**
   * 确保本地账号存在（LDAP 认证成功后调用）。
   * - 已存在 → 直接返回其 id（**不覆盖本地口令**，管理员重置过的口令优先）；
   * - 不存在 → 按 defaultRoleCodes 建号（口令用随机值占位：该账号只能走 LDAP 登录）。
   */
  async ensureLocalUser(info: LdapUserInfo): Promise<number> {
    const existing = await this.prisma.user.findUnique({
      where: { username: info.username },
      select: { id: true, status: true },
    });
    if (existing) {
      if (Number(existing.status) !== Status.ENABLED) {
        throw AppException.unauthorized('账号已被禁用');
      }
      return Number(existing.id);
    }
    const config = await this.prisma.ldapConfig.findUnique({ where: { id: SINGLETON_ID } });
    const roleCodes = (config?.defaultRoleCodes ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
    if (roleCodes.length === 0) {
      throw AppException.forbidden('该 LDAP 用户首次登录，但未配置默认角色，无法自动创建账号，请联系管理员');
    }
    const roles = await this.prisma.role.findMany({
      where: { roleCode: { in: roleCodes } },
      select: { id: true },
    });
    if (roles.length === 0) {
      throw AppException.badRequest('LDAP 配置的默认角色不存在，请联系管理员');
    }
    const user = await this.prisma.user.create({
      data: {
        username: info.username,
        nickname: info.nickname || info.username,
        email: info.email,
        status: Status.ENABLED,
        remark: 'LDAP 目录用户',
        // 随机占位口令：本地口令登录不可用（该账号走 LDAP 认证）
        password: await hashPassword(randomPlaceholderPassword()),
      },
    });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
      skipDuplicates: true,
    });
    this.logger.log(`LDAP 用户 ${info.username} 首次登录，已自动建号（#${user.id}）`);
    return Number(user.id);
  }

  /* -------------------------------- 内部实现 -------------------------------- */

  /** 创建 ldapjs 客户端（集中超时与 TLS 选项）。 */
  private createClient(options: { url: string; verifyCert: boolean; startTls: boolean }): Client {
    return ldap.createClient({
      url: options.url,
      connectTimeout: CONNECT_TIMEOUT_MS,
      timeout: CONNECT_TIMEOUT_MS,
      reconnect: false,
      tlsOptions: options.verifyCert ? {} : { rejectUnauthorized: false },
    });
  }

  /** bind 的 Promise 封装（ldapjs 是回调式 API）。 */
  private bind(client: Client, dn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  /** 搜索的 Promise 封装。 */
  private search(
    client: Client,
    baseDn: string,
    options: { scope: 'base' | 'sub'; filter: string; sizeLimit?: number; attributes?: string[] },
  ): Promise<ldap.SearchEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: ldap.SearchEntry[] = [];
      client.search(
        baseDn,
        {
          scope: options.scope,
          filter: options.filter,
          sizeLimit: options.sizeLimit,
          attributes: options.attributes,
        },
        (error, res) => {
          if (error) {
            reject(error);
            return;
          }
          res.on('searchEntry', (entry) => entries.push(entry));
          res.on('error', (searchError) => reject(searchError));
          res.on('end', () => resolve(entries));
        },
      );
    });
  }

  /** 取属性值（ldapjs 的 attributes 是稀疏结构，取数组首项）。 */
  private pickAttr(entry: ldap.SearchEntry, attr: string): string | null {
    const values = entry.attributes;
    if (!values || values.length === 0) {
      return null;
    }
    for (const item of values) {
      if (item.type === attr) {
        const first = item.values[0];
        return first === undefined ? null : String(first);
      }
    }
    return null;
  }
}

/** RFC 4515 过滤字符转义：防 `*)(uid=*` 类注入。 */
function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/** 占位口令（LDAP 账号不走本地口令，随机值只用于满足非空约束）。 */
function randomPlaceholderPassword(): string {
  return `ldap_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
