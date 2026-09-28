/**
 * 个人中心服务。
 * 模块职责：修改个人资料、修改密码（校验旧密码并写 passwordChangedAt）、更换头像。
 */
import { Dept, User } from '@/models';
import { invalidateAuthCache } from '@/services/authCache';
import { toUserBrief } from '@/services/auth.service';
import { saveFiles } from '@/services/file.service';
import type { UserBrief } from '@/types';
import { comparePassword, hashPassword } from '@/utils/password';
import { AppError } from '@/utils/response';
import type { ChangePasswordInput, UpdateProfileInput } from '@/validators/profile.validator';

/**
 * 修改个人资料。
 * @param userId 用户 id
 * @param input 资料参数
 */
export async function updateProfile(userId: number, input: UpdateProfileInput): Promise<UserBrief> {
  // include Dept：返回体需带上部门名，避免前端 store 更新后部门信息丢失
  const user = await User.findByPk(userId, { include: [{ model: Dept, attributes: ['deptName'] }] });
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  await user.update({
    nickname: input.nickname,
    email: input.email || null,
    phone: input.phone || null,
    gender: input.gender || null,
    avatar: input.avatar || user.avatar,
  });
  // 资料变更：失效该用户缓存，保证 /auth/profile 立即反映新昵称 / 头像
  invalidateAuthCache(userId);
  return toUserBrief(user);
}

/**
 * 修改密码：校验原密码，写入新哈希并更新 passwordChangedAt（旧 Token 失效）。
 * @param userId 用户 id
 * @param input 改密参数
 */
export async function changePassword(userId: number, input: ChangePasswordInput): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }

  const matched = await comparePassword(input.oldPassword, user.password);
  if (!matched) {
    throw AppError.badRequest('原密码不正确');
  }

  await user.update({
    password: await hashPassword(input.newPassword),
    passwordChangedAt: new Date(),
  });
  // 改密：失效缓存的旧 passwordChangedAt，保持「旧 Token 立即失效」语义（REQ-026）
  invalidateAuthCache(userId);
}

/**
 * 更换头像（复用上传能力并即时更新用户头像）。
 * @param userId 用户 id
 * @param file multer 文件
 * @returns 新头像地址
 */
export async function updateAvatar(userId: number, file: Express.Multer.File): Promise<{ avatar: string }> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }

  const [saved] = await saveFiles([file], userId);
  if (!saved) {
    throw AppError.badRequest('头像上传失败');
  }

  await user.update({ avatar: saved.fileUrl });
  // 头像变更：失效该用户缓存，保证 /auth/profile 立即反映新头像
  invalidateAuthCache(userId);
  return { avatar: saved.fileUrl };
}
