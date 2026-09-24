/**
 * 日志路由 `/api/logs`。
 * 模块职责：挂载登录/操作/HTTP 日志查询与导出接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as logController from '@/controllers/log.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/login', requirePermission('log:login:list'), asyncHandler(logController.loginLogs));
router.get('/login/export', requirePermission('log:login:export'), asyncHandler(logController.exportLoginLogs));

router.get('/operation', requirePermission('log:operation:list'), asyncHandler(logController.operationLogs));
router.get(
  '/operation/export',
  requirePermission('log:operation:export'),
  asyncHandler(logController.exportOperationLogs),
);

router.get('/http', requirePermission('log:http:list'), asyncHandler(logController.httpLogs));

// 清空所有 HTTP 日志：高危破坏性操作，必须使用独立的 log:http:clear 权限码，
// 不能复用只读的 log:http:list，否则任何能查看日志的角色都能清空日志。
router.delete('/http', requirePermission('log:http:clear'), asyncHandler(logController.clearHttpLogs));

export default router;
