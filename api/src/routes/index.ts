/**
 * 路由聚合入口。
 * 模块职责：将 12 个业务路由模块挂载到 `/api` 下。
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import configRoutes from './config.routes';
import dashboardRoutes from './dashboard.routes';
import deptRoutes from './dept.routes';
import dictRoutes from './dict.routes';
import fileRoutes from './file.routes';
import genRoutes from './gen.routes';
import logRoutes from './log.routes';
import menuRoutes from './menu.routes';
import profileRoutes from './profile.routes';
import roleRoutes from './role.routes';
import userRoutes from './user.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/menus', menuRoutes);
router.use('/depts', deptRoutes);
router.use('/dict', dictRoutes);
router.use('/configs', configRoutes);
router.use('/logs', logRoutes);
router.use('/files', fileRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/profile', profileRoutes);
router.use('/gen', genRoutes);

export default router;
