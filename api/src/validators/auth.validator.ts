/**
 * 认证校验 schema。
 * 模块职责：登录、刷新 Token、修改密码的 zod 校验规则。
 */
import { z } from 'zod';

/** 登录请求体。 */
export const loginSchema = z.object({
  username: z.string().min(1, '账号不能为空').max(50, '账号过长'),
  password: z.string().min(1, '密码不能为空').max(100, '密码过长'),
});

/** 刷新 Token 请求体。 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
});

/** 修改密码请求体。 */
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '原密码不能为空'),
    newPassword: z.string().min(6, '新密码至少 6 位').max(20, '新密码最多 20 位'),
    confirmPassword: z.string().min(1, '确认密码不能为空'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

/** 登录请求体类型。 */
export type LoginInput = z.infer<typeof loginSchema>;
/** 刷新请求体类型。 */
export type RefreshInput = z.infer<typeof refreshSchema>;
/** 修改密码请求体类型。 */
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
