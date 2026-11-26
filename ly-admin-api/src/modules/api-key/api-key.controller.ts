/**
 * 开放 API 控制器：服务账号（API Key）与 Webhook 订阅管理。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { IdParamDto } from '../../common/dto/id-param.dto.js';
import { ApiKeyService } from './api-key.service.js';
import { WebhookService } from './webhook.service.js';
import {
  ApiKeyQueryDto,
  CreateApiKeyDto,
  UpdateApiKeyDto,
  WebhookDeliveryQueryDto,
  WebhookDto,
} from './dto/api-key.dto.js';
import type { AuthUserContext } from '../../common/types.js';

@Controller('open')
export class ApiKeyController {
  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly webhooks: WebhookService,
  ) {}

  /* ------------------------------- API Key ------------------------------- */

  /** 密钥列表（含所属用户；密钥本体永不下发）。 */
  @Get('keys')
  listKeys(@Query() query: ApiKeyQueryDto): Promise<unknown> {
    return this.apiKeys.list(query as unknown as Record<string, unknown>);
  }

  /** 密钥详情。 */
  @Get('keys/:id')
  detailKey(@Param() params: IdParamDto): Promise<unknown> {
    return this.apiKeys.detail(params.id);
  }

  /** 签发密钥（明文仅此一次返回，请妥善保存）。 */
  @Post('keys')
  @OperationLog('开放 API', '签发密钥')
  createKey(@Body() dto: CreateApiKeyDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.apiKeys.create({
      name: dto.name,
      userId: dto.userId,
      scopes: dto.scopes,
      allowIps: dto.allowIps,
      expiresAt: dto.expiresAt,
      remark: dto.remark,
    });
  }

  /** 更新密钥配置（密钥本体不可改，轮换请删旧建新）。 */
  @Put('keys/:id')
  @OperationLog('开放 API', '编辑密钥')
  updateKey(
    @Param() params: IdParamDto,
    @Body() dto: UpdateApiKeyDto,
    @CurrentUser() _user: AuthUserContext,
  ): Promise<unknown> {
    return this.apiKeys.update(params.id, {
      name: dto.name,
      scopes: dto.scopes,
      allowIps: dto.allowIps,
      expiresAt: dto.expiresAt,
      remark: dto.remark,
    });
  }

  /** 启停密钥。 */
  @Put('keys/:id/status')
  @OperationLog('开放 API', '启停密钥')
  toggleKey(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.apiKeys.toggleStatus(params.id);
  }

  /** 删除密钥（立即失效）。 */
  @Delete('keys/:id')
  @OperationLog('开放 API', '删除密钥')
  async removeKey(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<null> {
    await this.apiKeys.remove(params.id);
    return null;
  }

  /* ------------------------------- Webhook ------------------------------- */

  /** 订阅列表。 */
  @Get('webhooks')
  listWebhooks(): Promise<unknown> {
    return this.webhooks.list();
  }

  /** 订阅详情。 */
  @Get('webhooks/:id')
  detailWebhook(@Param() params: IdParamDto): Promise<unknown> {
    return this.webhooks.detail(params.id);
  }

  /** 新增订阅。 */
  @Post('webhooks')
  @OperationLog('开放 API', '新增 Webhook')
  createWebhook(@Body() dto: WebhookDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.webhooks.create({
      name: dto.name,
      url: dto.url,
      events: dto.events,
      secret: dto.secret ?? '',
      remark: dto.remark,
    });
  }

  /** 更新订阅（secret 留空 = 不修改）。 */
  @Put('webhooks/:id')
  @OperationLog('开放 API', '编辑 Webhook')
  updateWebhook(
    @Param() params: IdParamDto,
    @Body() dto: WebhookDto,
    @CurrentUser() _user: AuthUserContext,
  ): Promise<unknown> {
    return this.webhooks.update(params.id, {
      name: dto.name,
      url: dto.url,
      events: dto.events,
      secret: dto.secret,
      status: dto.status,
      remark: dto.remark,
    });
  }

  /** 删除订阅。 */
  @Delete('webhooks/:id')
  @OperationLog('开放 API', '删除 Webhook')
  async removeWebhook(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<null> {
    await this.webhooks.remove(params.id);
    return null;
  }

  /** 手动测试推送。 */
  @Post('webhooks/:id/test')
  @OperationLog('开放 API', '测试 Webhook')
  testWebhook(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.webhooks.test(params.id);
  }

  /** 投递记录分页。 */
  @Get('webhook-deliveries')
  listDeliveries(@Query() query: WebhookDeliveryQueryDto): Promise<unknown> {
    return this.webhooks.listDeliveries(query as unknown as Record<string, unknown>);
  }
}
