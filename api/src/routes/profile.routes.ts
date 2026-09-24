/**
 * 个人中心路由 `/api/profile`。
 * 模块职责：挂载修改资料/修改密码/更换头像接口（登录即可访问）。
 *
 * ⚠️ 权限说明（显式豁免，勿在后续审查中补码）：
 * 本组三个接口操作的是**用户自己的**资料/密码/头像，任何登录用户修改自身账号都是合理语义，
 * 不构成越权，因此**有意只挂 authenticate、不加 requirePermission 权限码**。
 * 若补码会导致只读角色 viewer 连自己的密码/头像都无法修改。
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

// 自有资源，仅需登录态，有意不加权限码（见文件头说明）
router.put('/', validate({ body: updateProfileSchema }), asyncHandler(profileController.updateProfile));
router.put('/password', validate({ body: changePasswordSchema }), asyncHandler(profileController.changePassword));
router.post('/avatar', uploadSingle, asyncHandler(profileController.uploadAvatar));

export default router;
