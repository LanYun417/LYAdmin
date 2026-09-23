/**
 * 文件路由 `/api/files`。
 * 模块职责：挂载文件上传/列表/删除接口并施加鉴权与权限码。
 */
import { Router } from 'express';
import * as fileController from '@/controllers/file.controller';
import { authenticate } from '@/middlewares/auth';
import { requirePermission } from '@/middlewares/permission';
import { upload } from '@/middlewares/upload';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// 上传：兼容任意字段名（files / files[] / file），单次上限由 multer limits 控制
router.post('/upload', requirePermission('file:upload'), upload.any(), asyncHandler(fileController.upload));

// 秒传预检：与上传同权限码（命中重复时前端直接静默成功，不新增记录）
router.get('/check', requirePermission('file:upload'), asyncHandler(fileController.check));

router.get('/', requirePermission('file:list'), asyncHandler(fileController.list));

router.delete('/:id', requirePermission('file:remove'), asyncHandler(fileController.remove));

export default router;
