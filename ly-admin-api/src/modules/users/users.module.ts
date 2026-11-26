/**
 * 用户模块。
 * 模块职责：聚合用户 CRUD、状态、密码重置、角色分配接口。
 * PrismaService（全局 PrismaModule）与 CommonModule（含 DataScopeService / AuthCacheService）均全局，
 * 直接注入即可，无需在此 imports。
 *
 * 导入注册：onModuleInit 时把「用户 CSV 导入」注册到导入中心
 * （上传入队 → 队列执行 → 通知），与页面上的手动导入并存（后者为同步即时返回）。
 */
import { type OnModuleInit } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NoticeModule } from '../notice/notice.module.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { ImportModule } from '../../common/queue/import/import.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UsersImportService } from './users-import.service.js';
import { ImportService } from '../../common/queue/import/import.service.js';

@Module({
  controllers: [UsersController],
  imports: [NoticeModule, ApiKeyModule, ImportModule],
  providers: [UsersService, UsersImportService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly importService: ImportService,
    private readonly usersImport: UsersImportService,
  ) {}

  onModuleInit(): void {
    this.importService.register('users', '用户', async (csvText) => {
      // 用户导入已有「全成功或全不写」语义：created 为 0 即全部行级失败
      const result = await this.usersImport.importUsers(csvText);
      return {
        total: result.total,
        created: result.created,
        failed: result.failed.map((item) => ({ row: item.line, message: item.message })),
      };
    });
  }
}
