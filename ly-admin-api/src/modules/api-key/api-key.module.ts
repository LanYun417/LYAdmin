/**
 * 开放 API 模块。
 * 模块职责：服务账号（API Key）与 Webhook 外发。
 * 供用户/角色等业务模块注入 WebhookService 发布事件。
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { ApiKeyController } from './api-key.controller.js';
import { ApiKeyService } from './api-key.service.js';
import { WebhookService } from './webhook.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, WebhookService],
  exports: [ApiKeyService, WebhookService],
})
export class ApiKeyModule {}
