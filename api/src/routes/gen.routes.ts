/**
 * 代码生成路由 `/api/gen`。
 * 模块职责：挂载表查询、字段详情、预览、下载接口并施加鉴权与独立权限码。
 *
 * 权限严格分离：list / preview / download 使用三个独立权限码，
 * 只读角色一律不授予 preview / download，避免越权导出/下载源码。
 */
import { Router } from 'express';
import * as genController from '@/controllers/gen.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/tables', requirePermission('tool:gen:list'), asyncHandler(genController.listTables));
router.get('/tables/:tableName', requirePermission('tool:gen:list'), asyncHandler(genController.tableDetail));
router.post('/preview', requirePermission('tool:gen:preview'), asyncHandler(genController.preview));
router.post('/download', requirePermission('tool:gen:download'), asyncHandler(genController.download));

export default router;
