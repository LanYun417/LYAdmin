/**
 * 菜单路由 `/api/menus`。
 * 模块职责：挂载菜单 CRUD 与树查询接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as menuController from '@/controllers/menu.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { idParamSchema, menuListQuerySchema, menuUpsertSchema } from '@/validators/menu.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('system:menu:list'),
  validate({ query: menuListQuerySchema }),
  asyncHandler(menuController.list),
);

router.get('/tree', requirePermission('system:menu:list'), asyncHandler(menuController.tree));

router.get(
  '/:id',
  requirePermission('system:menu:query'),
  validate({ params: idParamSchema }),
  asyncHandler(menuController.detail),
);

router.post(
  '/',
  requirePermission('system:menu:add'),
  validate({ body: menuUpsertSchema }),
  asyncHandler(menuController.create),
);

router.put(
  '/:id',
  requirePermission('system:menu:edit'),
  validate({ params: idParamSchema, body: menuUpsertSchema }),
  asyncHandler(menuController.update),
);

router.delete(
  '/:id',
  requirePermission('system:menu:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(menuController.remove),
);

export default router;
