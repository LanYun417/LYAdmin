/**
 * 个人中心控制器。
 * 模块职责：解析个人中心请求参数、调用服务、组装统一响应。
 */
import type { Request, Response } from 'express';
import * as profileService from '@/services/profile.service';
import { AppError, ok } from '@/utils/response';
import type { ChangePasswordInput, UpdateProfileInput } from '@/validators/profile.validator';

/** 修改资料。 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const result = await profileService.updateProfile(req.user!.userId, req.body as UpdateProfileInput);
  ok(res, result, '资料更新成功');
}

/** 修改密码。 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  await profileService.changePassword(req.user!.userId, req.body as ChangePasswordInput);
  ok(res, null, '密码修改成功，请重新登录');
}

/** 更换头像。 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw AppError.badRequest('未接收到头像文件');
  }
  const result = await profileService.updateAvatar(req.user!.userId, req.file);
  ok(res, result, '头像更新成功');
}
