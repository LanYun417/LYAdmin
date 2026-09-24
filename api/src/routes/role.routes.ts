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

// 全部角色下拉。使用独立权限码 system:role:all，而非复用只读的 system:role:list：
// 历史上 admin 故意没有 system:role:list，而本接口是给持 system:user:assignRole 的角色
// 拉取「分配角色」下拉框用的；复用 system:role:list 会把该能力收死，故新开独立码——
// 既能堵住 viewer 枚举全部角色（含 super_admin），又不破坏分配角色下拉。
router.get('/all', requirePermission('system:role:all'), asyncHandler(roleController.all));

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
