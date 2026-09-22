/**
 * 仪表盘路由 `/api/dashboard`。
 * 模块职责：挂载统计卡片、登录趋势、操作分布、角色用户数接口（登录即可访问）。
 */
import { Router } from 'express';
import * as dashboardController from '@/controllers/dashboard.controller';
import { authenticate } from '@/middlewares/auth';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/stats', asyncHandler(dashboardController.stats));
router.get('/login-trend', asyncHandler(dashboardController.loginTrend));
router.get('/operation-distribution', asyncHandler(dashboardController.operationDistribution));
router.get('/role-user-count', asyncHandler(dashboardController.roleUserCount));

export default router;
