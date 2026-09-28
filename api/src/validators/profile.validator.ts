/**
 * 个人中心校验 schema。
 * 模块职责：个人资料修改、修改密码的 zod 规则（改密规则复用 auth.validator）。
 */
import { z } from 'zod';
import { REGEX } from '@/constants';

export { changePasswordSchema, type ChangePasswordInput } from './auth.validator';

/** 修改资料。 */
export const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1, '昵称不能为空').max(50, '昵称过长'),
  email: z.union([z.string().regex(REGEX.EMAIL, '邮箱格式不正确'), z.literal('')]).optional(),
  phone: z.union([z.string().regex(REGEX.PHONE, '手机号格式不正确'), z.literal('')]).optional(),
  /** 性别：字典 sys_user_sex 的值（1 男 / 2 女 / 0 未知），空串表示未设置 */
  gender: z.union([z.string().trim().max(20, '性别值过长'), z.literal('')]).optional(),
  avatar: z.string().max(255, '头像地址过长').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
