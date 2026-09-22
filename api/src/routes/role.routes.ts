/**
 * 角色路由 `/api/roles`。
 * 模块职责：挂载角色 CRUD、下拉、菜单授权接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as roleController from '@/controllers/role.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  assignMenuSchema,
  createRoleSchema,
  idParamSchema,
  roleListQuerySchema,
  updateRoleSchema,
} from '@/validators/role.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('system:role:list'),
  validate({ query: roleListQuerySchema }),
  asyncHandler(roleController.list),
);

router.get('/all', asyncHandler(roleController.all));

router.post(
  '/',
  requirePermission('system:role:add'),
  validate({ body: createRoleSchema }),
  asyncHandler(roleController.create),
);

router.put(
  '/:id',
  requirePermission('system:role:edit'),
  validate({ params: idParamSchema, body: updateRoleSchema }),
  asyncHandler(roleController.update),
);

router.delete(
  '/:id',
  requirePermission('system:role:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(roleController.remove),
);

router.get(
  '/:id/menus',
  requirePermission('system:role:query'),
  validate({ params: idParamSchema }),
  asyncHandler(roleController.menus),
);

router.put(
  '/:id/menus',
  requirePermission('system:role:assignMenu'),
  validate({ params: idParamSchema, body: assignMenuSchema }),
  asyncHandler(roleController.assignMenus),
);

export default router;
