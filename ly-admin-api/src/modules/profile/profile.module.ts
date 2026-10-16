/**
 * 个人中心模块。
 * 模块职责：聚合修改资料/修改密码/更换头像接口。
 * 导入 FilesModule 以复用 FilesService 保存头像（共享幻数校验/秒传逻辑）。
 * PrismaService（全局 PrismaModule）与 CommonModule（含 AuthCacheService）均全局，直接注入。
 */
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [FilesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
