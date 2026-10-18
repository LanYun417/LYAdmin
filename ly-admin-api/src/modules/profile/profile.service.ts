/**
 * 个人中心服务。
 * 模块职责：修改个人资料、修改密码（校验旧密码并写 passwordChangedAt）、更换头像。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { lookupDeptName } from '../../common/utils/dept-lookup.js';
import { comparePassword, hashPassword } from '../../common/utils/utils.js';
import type { UserBrief } from '../../common/types.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FilesService } from '../files/files.service.js';

/** 修改资料入参。 */
export interface UpdateProfileInput {
  nickname: string;
  email?: string;
  phone?: string;
  gender?: string;
  avatar?: string;
}

/** 修改密码入参。 */
export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
    private readonly filesService: FilesService,
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

  /** 修改个人资料。 */
  async updateProfile(userId: number, input: UpdateProfileInput): Promise<UserBrief> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
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

  /** 修改密码：校验原密码，写入新哈希并更新 passwordChangedAt（旧 Token 失效）。 */
  async changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    const matched = await comparePassword(input.oldPassword, user.password);
    if (!matched) {
      throw AppException.badRequest('原密码不正确');
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
  async updateAvatar(userId: number, file: Express.Multer.File): Promise<{ avatar: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw AppException.notFound('用户不存在');
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
}
