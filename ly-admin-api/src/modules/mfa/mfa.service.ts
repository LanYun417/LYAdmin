/**
 * 多因素认证（TOTP）服务。
 * 模块职责：绑定 / 解绑二次验证、恢复码签发与核销、登录第二因子校验。
 *
 * 口径：
 * - 种子两段式：`setup` 只写入「未启用」的种子并返回 otpauth URL，用户在
 *   authenticator 里添加后回填动态码，`enable` 校验通过才真正启用——
 *   防止「扫码失败/中途放弃」留下一个启用着的死密钥；
 * - 恢复码一次性：核销即从哈希集合中移除，避免同一个码被重复使用；
 * - 降级：SECRETS_ENCRYPTION_KEY 未配置时整个模块禁用（配置中心已把关），
 *   控制器不会注册路由之外的调用；服务内部对解密失败一律抛业务异常。
 */
import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import { comparePassword, hashPassword } from '../../common/utils/utils.js';
import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from '../../common/crypto/totp.js';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-box.js';
import { config } from '../../common/config/config.js';

/** 一次性恢复码数量。 */
const RECOVERY_CODE_COUNT = 10;
/** 恢复码分组显示宽度（展示用，存储用完整串）。 */
const RECOVERY_GROUP_SIZE = 4;

/** 对外状态（不含种子本身）。 */
export interface MfaStatus {
  /** 是否已启用 */
  enabled: boolean;
  /** 是否已有未确认的种子（setup 后、enable 前） */
  pending: boolean;
  /** 剩余可用恢复码数量 */
  recoveryRemaining: number;
  /** 启用时间（未启用为 null） */
  enabledAt: Date | null;
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 查询当前用户的 MFA 状态。 */
  async getStatus(userId: number): Promise<MfaStatus> {
    const row = await this.prisma.userMfa.findUnique({ where: { id: BigInt(userId) } });
    if (!row) {
      return { enabled: false, pending: false, recoveryRemaining: 0, enabledAt: null };
    }
    return {
      enabled: Number(row.enabled) === 1,
      pending: Number(row.enabled) === 0,
      recoveryRemaining: this.readRecovery(row.recovery).length,
      enabledAt: row.enabledAt,
    };
  }

  /**
   * 开始绑定：校验登录口令后生成种子（未启用状态）。
   * 已启用的账号必须先解绑——避免「拿着旧密钥又生成新密钥」的歧义。
   */
  async setup(userId: number, username: string, password: string): Promise<{ secret: string; otpauthUrl: string }> {
    await this.assertPassword(userId, password);
    const existing = await this.prisma.userMfa.findUnique({ where: { id: BigInt(userId) } });
    if (existing && Number(existing.enabled) === 1) {
      throw AppException.conflict('二次验证已启用，如需更换请先解绑');
    }
    const secret = generateTotpSecret(randomBytes);
    await this.prisma.userMfa.upsert({
      where: { id: BigInt(userId) },
      update: { secret: encryptSecret(secret), enabled: 0, recovery: null, enabledAt: null },
      create: { id: BigInt(userId), secret: encryptSecret(secret), enabled: 0 },
    });
    const otpauthUrl = buildOtpAuthUrl({ account: username, issuer: config.mfa.issuer, secretBase32: secret });
    return { secret, otpauthUrl };
  }

  /**
   * 确认绑定：校验 authenticator 回填的动态码，通过后启用并签发恢复码。
   * @returns 恢复码（仅此一次明文返回，之后只存哈希）
   */
  async enable(userId: number, code: string): Promise<string[]> {
    const row = await this.prisma.userMfa.findUnique({ where: { id: BigInt(userId) } });
    if (!row) {
      throw AppException.badRequest('请先开始绑定二次验证');
    }
    if (Number(row.enabled) === 1) {
      throw AppException.conflict('二次验证已启用');
    }
    const secret = decryptSecret(row.secret);
    if (!verifyTotp(secret, code)) {
      throw AppException.badRequest('动态码错误，请检查 authenticator 时间与输入');
    }
    const recovery = await this.generateRecoveryCodes();
    await this.prisma.userMfa.update({
      where: { id: BigInt(userId) },
      data: { enabled: 1, recovery: JSON.stringify(recovery.hashes), enabledAt: new Date() },
    });
    this.logger.log(`用户 ${userId} 启用二次验证`);
    return recovery.codes;
  }

  /** 解绑：校验登录口令后删除绑定（恢复码一并失效）。 */
  async disable(userId: number, password: string): Promise<void> {
    await this.assertPassword(userId, password);
    await this.prisma.userMfa.deleteMany({ where: { id: BigInt(userId) } });
    this.logger.log(`用户 ${userId} 解绑二次验证`);
  }

  /** 重新签发恢复码（需通过一次动态码校验）。旧码全部作废。 */
  async regenerateRecovery(userId: number, code: string): Promise<string[]> {
    const row = await this.prisma.userMfa.findUnique({ where: { id: BigInt(userId) } });
    if (!row || Number(row.enabled) !== 1) {
      throw AppException.badRequest('二次验证未启用');
    }
    const secret = decryptSecret(row.secret);
    if (!verifyTotp(secret, code)) {
      throw AppException.badRequest('动态码错误');
    }
    const recovery = await this.generateRecoveryCodes();
    await this.prisma.userMfa.update({
      where: { id: BigInt(userId) },
      data: { recovery: JSON.stringify(recovery.hashes) },
    });
    return recovery.codes;
  }

  /** 登录第二因子校验：动态码或恢复码（核销）。 */
  async verifyLoginCode(userId: number, code: string): Promise<void> {
    const row = await this.prisma.userMfa.findUnique({ where: { id: BigInt(userId) } });
    if (!row || Number(row.enabled) !== 1) {
      // 账号在拿到挑战令牌后解绑了 MFA：按「无需第二因子」放行更合理
      return;
    }
    const secret = decryptSecret(row.secret);
    if (verifyTotp(secret, code)) {
      return;
    }
    // 恢复码路径：命中即核销（移除该哈希）
    const hashes = this.readRecovery(row.recovery);
    for (const hash of hashes) {
      if (await comparePassword(code, hash)) {
        const remaining = hashes.filter((item) => item !== hash);
        await this.prisma.userMfa.update({
          where: { id: BigInt(userId) },
          data: { recovery: JSON.stringify(remaining) },
        });
        this.logger.log(`用户 ${userId} 使用恢复码登录，剩余 ${remaining.length} 个`);
        return;
      }
    }
    throw AppException.unauthorized('动态码或恢复码错误');
  }

  /** 是否已启用（登录流程快速判定，查不到记录即未启用）。 */
  async isEnabled(userId: number): Promise<boolean> {
    const row = await this.prisma.userMfa.findUnique({
      where: { id: BigInt(userId) },
      select: { enabled: true },
    });
    return Number(row?.enabled ?? 0) === 1;
  }

  /** 校验登录口令（复用 bcrypt 比对，错误时抛 401）。 */
  private async assertPassword(userId: number, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { password: true },
    });
    if (!user || !(await comparePassword(password, user.password))) {
      throw AppException.unauthorized('登录口令错误');
    }
  }

  /** 读取恢复码哈希数组（坏 JSON 视为空，不让脏数据堵死流程）。 */
  private readRecovery(raw: string | null): string[] {
    if (!raw) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  /** 生成恢复码（明文给用户，库内只留 bcrypt 哈希）。 */
  private async generateRecoveryCodes(): Promise<{ codes: string[]; hashes: string[] }> {
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      const code = randomBytes(9)
        .toString('base64url')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12);
      const grouped = (code.match(new RegExp(`.{1,${RECOVERY_GROUP_SIZE}}`, 'g')) ?? [code]).join('-');
      codes.push(grouped);
      hashes.push(await hashPassword(grouped));
    }
    return { codes, hashes };
  }
}
