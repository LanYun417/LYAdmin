/**
 * 部门路由 `/api/depts`。
 * 模块职责：挂载部门 CRUD 与树查询接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as deptController from '@/controllers/dept.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { deptListQuerySchema, deptUpsertSchema, idParamSchema } from '@/validators/dept.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('system:dept:list'),
  validate({ query: deptListQuerySchema }),
  asyncHandler(deptController.list),
);

router.get('/tree', requirePermission('system:dept:list'), asyncHandler(deptController.tree));

router.get(
  '/:id',
  requirePermission('system:dept:query'),
  validate({ params: idParamSchema }),
  asyncHandler(deptController.detail),
);

router.post(
  '/',
  requirePermission('system:dept:add'),
  validate({ body: deptUpsertSchema }),
  asyncHandler(deptController.create),
);

router.put(
  '/:id',
  requirePermission('system:dept:edit'),
  validate({ params: idParamSchema, body: deptUpsertSchema }),
  asyncHandler(deptController.update),
);

router.delete(
  '/:id',
  requirePermission('system:dept:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(deptController.remove),
);

export default router;
