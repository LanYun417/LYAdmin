/**
 * 代码生成路由 `/api/gen`。
 * 模块职责：挂载表查询、字段详情、预览、下载、生成落盘接口并施加鉴权与独立权限码。
 *
 * 权限严格分离：list / preview / download / create 使用四个独立权限码，
 * 只读角色一律不授予 preview / download / create，避免越权导出、下载或写入源码。
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
// 直接写入项目目录属写操作，必须使用独立的 tool:gen:create 权限码，不得复用预览/下载码
router.post('/create', requirePermission('tool:gen:create'), asyncHandler(genController.create));

export default router;
