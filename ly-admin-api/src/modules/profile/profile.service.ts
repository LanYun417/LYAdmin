/**
 * 个人中心服务。
 * 模块职责：修改个人资料、修改密码（校验旧密码并写 passwordChangedAt）、更换头像。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { GUEST_ROLE_CODES, GUEST_USERNAMES } from '../../common/config/constants.js';
import { lookupDeptName } from '../../common/utils/dept-lookup.js';
import { comparePassword, hashPassword } from '../../common/utils/utils.js';
import type { UserBrief } from '../../common/types.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { assertPasswordNotContainsAccount } from '../../common/auth/password-policy.js';
import { parseUserAgent } from '../../common/utils/user-agent.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { SessionService } from '../../common/auth/session.service.js';
import { FilesService } from '../files/files.service.js';

/** 修改资料入参。 */
export interface UpdateProfileInput {
  nickname: string;
  email?: string;
  phone?: string;
  gender?: string;
  avatar?: string;
}

/** 更新扩展资料入参（Sprint 5）。 */
export interface UpdateProfileExtraInput {
  signature?: string;
  /** YYYY-MM-DD（服务层转 Date） */
  birthday?: string | null;
  company?: string;
  position?: string;
  address?: string;
}

/** 我的在线会话（画像项）。 */
export interface SessionProfileItem {
  sid: string;
  ip: string;
  location: string;
  browser: string | null;
  os: string | null;
  userAgent: string;
  loginAt: Date;
  lastSeenAt: Date;
  /** 是否当前请求所在的会话（「本机」标记） */
  current: boolean;
}

/** 个人中心详情：账户 + 扩展资料 + 会话画像。 */
export interface ProfileDetail {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  status: number;
  deptId: number;
  deptName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  signature: string | null;
  birthday: Date | null;
  company: string | null;
  position: string | null;
  address: string | null;
  sessions: SessionProfileItem[];
}

/** 修改密码入参。 */
export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
    private readonly filesService: FilesService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
  ) {}

  /** 把用户记录转换为对外 UserBrief（含部门名）。 */
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
    dept?: { deptName: string | null } | null;
  }): UserBrief {
    return {
      id: Number(user.id),
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
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
  private async deptRef(deptId: bigint): Promise<{ deptName: string | null } | null> {
    const deptName = await lookupDeptName(this.prisma, deptId);
    return deptName === null ? null : { deptName };
  }

  /** 判断是否为只读访客（固定演示用户名或只读访客角色），用于拦截自助改密 / 改资料 / 换头像。 */
  private isReadonlyGuest(user: { username: string }, roleCodes: string[]): boolean {
    return GUEST_USERNAMES.includes(user.username) || roleCodes.some((code) => GUEST_ROLE_CODES.includes(code));
  }

  /** 修改个人资料。 */
  async updateProfile(userId: number, input: UpdateProfileInput, roleCodes: string[]): Promise<UserBrief> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    // 只读访客不允许修改个人资料：其身份为公开共享的只读演示账号，资料不应被改掉。
    // 判定规则与「修改密码」一致（见 isReadonlyGuest），需要变更时由管理员处理。
    if (this.isReadonlyGuest(user, roleCodes)) {
      throw AppException.conflict('只读访客账号不支持修改个人资料，如需变更请联系超级管理员');
    }
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        nickname: input.nickname,
        email: input.email || null,
        phone: input.phone || null,
        gender: input.gender || null,
        avatar: input.avatar || user.avatar,
      },
    });
    this.authCache.invalidate(userId);
    return this.toUserBrief({
      ...user,
      ...input,
      avatar: input.avatar || user.avatar,
      dept: await this.deptRef(user.deptId),
    });
  }

  /**
   * 修改密码：校验原密码，写入新哈希并更新 passwordChangedAt（旧 Token 失效）。
   *
   * @param userId 当前用户 id
   * @param input 原密码 + 新密码
   * @param roleCodes 当前用户的角色编码（用于识别只读访客）
   */
  async changePassword(userId: number, input: ChangePasswordInput, roleCodes: string[]): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    // 只读访客不允许自助改密：演示账号的密码是公开共享的，被改掉后其他体验者就登不进来了。
    // 判定「访客」有两条：固定的演示用户名白名单 + 只读访客角色（viewer）——后者覆盖管理员
    // 新建的任意只读账号，避免换个用户名绕过白名单。
    // 需要变更时由管理员在「用户管理 → 重置密码」处理（见 users.service.resetPassword）。
    //
    // 用 409 而非 403：403 会被前端拦截器判定为「越权」并整页跳 /403，而这里只是
    // 「该账号类型不支持这个操作」，与内置字典/内置参数的保护规则同级（见 dict/config service）。
    if (this.isReadonlyGuest(user, roleCodes)) {
      throw AppException.conflict('只读访客账号不支持自助修改密码，请联系管理员重置');
    }
    const matched = await comparePassword(input.oldPassword, user.password);
    if (!matched) {
      throw AppException.badRequest('原密码不正确');
    }
    // 新口令不得与账号互相包含，也不得与原口令相同（防「改了个寂寞」）
    assertPasswordNotContainsAccount(input.newPassword, user.username);
    if (input.newPassword === input.oldPassword) {
      throw AppException.badRequest('新密码不能与原密码相同');
    }
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        password: await hashPassword(input.newPassword),
        passwordChangedAt: new Date(),
      },
    });
    this.authCache.invalidate(userId);
  }

  /** 更换头像（复用上传能力并即时更新用户头像）。 */
  async updateAvatar(userId: number, file: Express.Multer.File, roleCodes: string[]): Promise<{ avatar: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    // 只读访客不允许更换头像，理由同「修改个人资料」。
    if (this.isReadonlyGuest(user, roleCodes)) {
      throw AppException.conflict('只读访客账号不支持更换头像，如需变更请联系超级管理员');
    }
    const [saved] = await this.filesService.saveFiles([file], userId);
    if (!saved) {
      throw AppException.badRequest('头像上传失败');
    }
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { avatar: saved.fileUrl },
    });
    this.authCache.invalidate(userId);
    return { avatar: saved.fileUrl };
  }

  /* ------------------------------ Sprint 5：扩展资料与用户画像 ------------------------------ */

  /**
   * 个人中心详情：账户信息 + 扩展资料 + 在线会话画像。
   *
   * 画像数据直接来自 Redis 会话表（SessionService），不落库：
   * 「当前 sid / 登录时间 / 最后活跃」本就是会话记录字段，同步一份到 MySQL
   * 只会多一处需要兜一致性的真相源。Redis 不可用时画像降级为空列表。
   */
  async getProfileDetail(userId: number, currentSid?: string): Promise<ProfileDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: BigInt(userId) } });

    // 我的在线会话（画像）：按用户名过滤（会话记录里带 username 快照）
    let sessions: SessionProfileItem[] = [];
    try {
      if (this.redis.isReady()) {
        const records = await this.sessionService.list({ username: user.username });
        sessions = records.map((record) => {
          // UA 解析与在线用户页同一口径（parseUserAgent）
          const { browser, os } = parseUserAgent(record.userAgent);
          return {
            sid: record.sid,
            ip: record.ip,
            location: record.location,
            browser,
            os,
            userAgent: record.userAgent,
            loginAt: new Date(record.loginAt),
            lastSeenAt: new Date(record.lastSeenAt),
            // 「本机」标记：当前请求令牌携带的 sid（守卫写入 req.tokenSid）
            current: currentSid !== undefined && record.sid === currentSid,
          };
        });
      }
    } catch (error) {
      this.logger.warn(`读取用户画像失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    const brief = this.toUserBrief({ ...user, dept: await this.deptRef(user.deptId) });
    return {
      id: brief.id,
      username: brief.username,
      nickname: brief.nickname,
      avatar: brief.avatar,
      email: brief.email,
      phone: brief.phone,
      gender: brief.gender,
      status: brief.status,
      deptId: brief.deptId,
      deptName: brief.deptName,
      lastLoginAt: brief.lastLoginAt,
      // UserBrief 的时间字段可选（列表场景可能不选），详情一定来自 user 行本体
      createdAt: brief.createdAt ?? user.createdAt,
      updatedAt: brief.updatedAt ?? user.updatedAt,
      signature: profile?.signature ?? null,
      birthday: profile?.birthday ?? null,
      company: profile?.company ?? null,
      position: profile?.position ?? null,
      address: profile?.address ?? null,
      sessions,
    };
  }

  /**
   * 更新扩展资料（懒创建 upsert：没填过资料的用户首次提交即建行）。
   */
  async updateProfileExtended(
    userId: number,
    input: UpdateProfileExtraInput,
    roleCodes: string[],
  ): Promise<ProfileDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    if (this.isReadonlyGuest(user, roleCodes)) {
      throw AppException.conflict('只读访客账号不支持修改个人资料，如需变更请联系超级管理员');
    }
    // DTO 是 YYYY-MM-DD 字符串；落库为 Date（列类型 @db.Date，时分秒无意义）。
    // ⚠️ 必须用 Date.UTC 构造：Prisma 把 Date 写 @db.Date 时按 UTC 取日期部分，
    // 用本地时区零点（new Date('1990-01-02T00:00:00')）在 UTC+8 会变成前一天的 16:00Z，
    // 落库后退一天（实测 1990-01-02 存成 1990-01-01）。
    const birthday = input.birthday
      ? (() => {
          const [year, month, day] = input.birthday.split('-').map(Number);
          return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
        })()
      : null;
    await this.prisma.userProfile.upsert({
      where: { userId: BigInt(userId) },
      create: {
        userId: BigInt(userId),
        signature: input.signature || null,
        birthday,
        company: input.company || null,
        position: input.position || null,
        address: input.address || null,
      },
      update: {
        signature: input.signature || null,
        birthday,
        company: input.company || null,
        position: input.position || null,
        address: input.address || null,
      },
    });
    return this.getProfileDetail(userId);
  }

  /**
   * 下线自己的某个会话（「踢掉其他设备」的个人中心版本）。
   * 归属校验在这里做：sid 必须属于当前用户，防止拿别人的 sid 来踢。
   */
  async removeOwnSession(userId: number, sid: string): Promise<void> {
    // 归属校验：只读当前用户的会话索引，sid 不在其中即拒绝（防踢别人）
    const owned = (await this.sessionService.listSidsOfUser(userId)).includes(sid);
    if (!owned) {
      throw AppException.forbidden('只能下线自己的会话');
    }
    await this.sessionService.remove(sid, userId);
  }
}
