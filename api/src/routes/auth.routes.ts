/**
 * 认证路由 `/api/auth`。
 * 模块职责：挂载登录/刷新/登出/用户信息/菜单树/权限码接口。
 */
import { Router } from 'express';
import * as authController from '@/controllers/auth.controller';
import { authenticate } from '@/middlewares/auth';
import { loginRateLimit } from '@/middlewares/loginRateLimit';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { loginSchema, refreshSchema } from '@/validators/auth.validator';

const router = Router();

// 图形验证码：公开接口（登录前获取），无需鉴权
router.get('/captcha', asyncHandler(authController.captcha));
// 登录路由挂载频率限制：连续失败 5 次 / 5 分钟 → 锁定 15 分钟（返回 429），登录成功清零
router.post('/login', loginRateLimit(), validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/profile', authenticate, asyncHandler(authController.profile));
router.get('/menus', authenticate, asyncHandler(authController.menus));
router.get('/permissions', authenticate, asyncHandler(authController.permissions));

export default router;
