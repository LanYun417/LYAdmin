/**
 * 系统参数路由 `/api/configs`。
 * 模块职责：挂载参数管理接口与业务取数接口，并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as configController from '@/controllers/config.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  configKeyParamSchema,
  configListQuerySchema,
  createConfigSchema,
  idParamSchema,
  updateConfigSchema,
} from '@/validators/config.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('system:config:list'),
  validate({ query: configListQuerySchema }),
  asyncHandler(configController.list),
);

router.post(
  '/',
  requirePermission('system:config:add'),
  validate({ body: createConfigSchema }),
  asyncHandler(configController.create),
);

// 按键取参数值：**仅需登录，不设权限码**（与 /api/dict/data/:dictType 同类处理）。
// 理由：参数是运行时可调的 UI/业务元数据，任意业务页面都可能读取；若强加权限码，
// 每个角色都得额外授予参数权限，与最小权限原则相悖。
router.get('/data/:configKey', validate({ params: configKeyParamSchema }), asyncHandler(configController.data));

router.get(
  '/:id',
  requirePermission('system:config:query'),
  validate({ params: idParamSchema }),
  asyncHandler(configController.detail),
);

router.put(
  '/:id',
  requirePermission('system:config:edit'),
  validate({ params: idParamSchema, body: updateConfigSchema }),
  asyncHandler(configController.update),
);

router.delete(
  '/:id',
  requirePermission('system:config:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(configController.remove),
);

export default router;
