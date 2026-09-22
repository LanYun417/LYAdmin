/**
 * 个人中心路由 `/api/profile`。
 * 模块职责：挂载修改资料/修改密码/更换头像接口（登录即可访问）。
 */
import { Router } from 'express';
import * as profileController from '@/controllers/profile.controller';
import { authenticate } from '@/middlewares/auth';
import { uploadSingle } from '@/middlewares/upload';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { changePasswordSchema, updateProfileSchema } from '@/validators/profile.validator';

const router = Router();

router.use(authenticate);

router.put('/', validate({ body: updateProfileSchema }), asyncHandler(profileController.updateProfile));
router.put('/password', validate({ body: changePasswordSchema }), asyncHandler(profileController.changePassword));
router.post('/avatar', uploadSingle, asyncHandler(profileController.uploadAvatar));

export default router;
