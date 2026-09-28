/**
 * 字典路由 `/api/dict`。
 * 模块职责：挂载字典类型 / 字典项的管理接口与业务取数接口，并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as dictController from '@/controllers/dict.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import {
  createDictItemSchema,
  createDictTypeSchema,
  dictItemListQuerySchema,
  dictStatusSchema,
  dictTypeListQuerySchema,
  dictTypeParamSchema,
  idParamSchema,
  updateDictItemSchema,
  updateDictTypeSchema,
} from '@/validators/dict.validator';

const router = Router();

router.use(authenticate);

/* ------------------------------ 字典类型 ------------------------------ */

router.get(
  '/types',
  requirePermission('system:dict:list'),
  validate({ query: dictTypeListQuerySchema }),
  asyncHandler(dictController.typeList),
);

router.post(
  '/types',
  requirePermission('system:dict:add'),
  validate({ body: createDictTypeSchema }),
  asyncHandler(dictController.typeCreate),
);

router.put(
  '/types/:id',
  requirePermission('system:dict:edit'),
  validate({ params: idParamSchema, body: updateDictTypeSchema }),
  asyncHandler(dictController.typeUpdate),
);

// 启停用是写操作，复用 system:dict:edit；绝不复用只读的 system:dict:list（见项目权限铁律）
router.put(
  '/types/:id/status',
  requirePermission('system:dict:edit'),
  validate({ params: idParamSchema, body: dictStatusSchema }),
  asyncHandler(dictController.typeSetStatus),
);

router.delete(
  '/types/:id',
  requirePermission('system:dict:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(dictController.typeRemove),
);

/* ------------------------------ 字典项 ------------------------------ */

router.get(
  '/items',
  requirePermission('system:dict:list'),
  validate({ query: dictItemListQuerySchema }),
  asyncHandler(dictController.itemList),
);

router.post(
  '/items',
  requirePermission('system:dict:add'),
  validate({ body: createDictItemSchema }),
  asyncHandler(dictController.itemCreate),
);

router.put(
  '/items/:id',
  requirePermission('system:dict:edit'),
  validate({ params: idParamSchema, body: updateDictItemSchema }),
  asyncHandler(dictController.itemUpdate),
);

router.put(
  '/items/:id/status',
  requirePermission('system:dict:edit'),
  validate({ params: idParamSchema, body: dictStatusSchema }),
  asyncHandler(dictController.itemSetStatus),
);

router.delete(
  '/items/:id',
  requirePermission('system:dict:remove'),
  validate({ params: idParamSchema }),
  asyncHandler(dictController.itemRemove),
);

/* ------------------------------ 业务取数 ------------------------------ */

// 按类型取字典数据：**仅需登录，不设权限码**（与 /api/profile 的「自有资源豁免」同类处理）。
// 理由：字典是 UI 元数据，任意业务页面都可能用它渲染下拉/标签；若强加权限码，则每个角色
// 都得额外授予字典权限，与最小权限原则相悖。数据本身不含敏感信息（仅标签与值）。
router.get('/data/:dictType', validate({ params: dictTypeParamSchema }), asyncHandler(dictController.data));

export default router;
