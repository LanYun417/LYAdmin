/**
 * 文件模块。
 * 模块职责：聚合文件上传/列表/下载/删除与类型/上传人筛选项接口。
 * PrismaService（全局 PrismaModule）已全局，直接注入即可。
 * 导出 FilesService 供个人中心模块复用以保存头像（共享同一套幻数校验/秒传逻辑）。
 */
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
