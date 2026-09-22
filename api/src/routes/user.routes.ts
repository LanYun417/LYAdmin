/**
 * 用户路由 `/api/users`。
 * 模块职责：挂载用户 CRUD、状态、重置密码、分配角色接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as userController from '@/controllers/user.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  assignRoleSchema,
  createUserSchema,
  idParamSchema,
  resetPasswordSchema,
  updateUserSchema,
  userListQuerySchema,
  userStatusSchema,
} from '@/validators/user.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('system:user:list'),
  validate({ query: userListQuerySchema }),
  asyncHandler(userController.list),
);

router.get(
  '/:id',
  requirePermission('system:user:query'),
  validate({ params: idParamSchema }),
  asyncHandler(userController.detail),
);

router.post(
  '/',
  requirePermission('system:user:add'),
  validate({ body: createUserSchema }),
  asyncHandler(userController.create),
);

router.put(
  '/:id',
  requirePermission('system:user:edit'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);

router.delete(
  '/:id',
  requirePermission('system:user:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(userController.remove),
);

router.put(
  '/:id/status',
  requirePermission('system:user:edit'),
  validate({ params: idParamSchema, body: userStatusSchema }),
  asyncHandler(userController.changeStatus),
);

router.put(
  '/:id/password',
  requirePermission('system:user:resetPwd'),
  validate({ params: idParamSchema, body: resetPasswordSchema }),
  asyncHandler(userController.resetPassword),
);

router.put(
  '/:id/roles',
  requirePermission('system:user:assignRole'),
  validate({ params: idParamSchema, body: assignRoleSchema }),
  asyncHandler(userController.assignRoles),
);

export default router;
