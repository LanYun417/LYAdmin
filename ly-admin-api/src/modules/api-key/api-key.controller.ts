/**
 * 开放 API 控制器：服务账号（API Key）与 Webhook 订阅管理。
 *
 * 权限口径（与种子菜单的按钮权限一致，读用 `:query`，写按动作分 `:add/:edit/:remove`）：
 * - 密钥：读 → `system:apiKey:query`，签发 → `:add`，改配置/启停 → `:edit`，删除 → `:remove`；
 * - Webhook：读 → `system:webhook:query`，新增 → `:add`，编辑/测试 → `:edit`，删除 → `:remove`。
 *
 * 缺失装饰器的接口「只要登录即可访问」——曾因此漏出可自签密钥的裸接口，故此处逐条显式声明。
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
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
  @RequirePermissions('system:apiKey:query')
  listKeys(@Query() query: ApiKeyQueryDto): Promise<unknown> {
    return this.apiKeys.list(query as unknown as Record<string, unknown>);
  }

  /** 密钥详情。 */
  @Get('keys/:id')
  @RequirePermissions('system:apiKey:query')
  detailKey(@Param() params: IdParamDto): Promise<unknown> {
    return this.apiKeys.detail(params.id);
  }

  /** 签发密钥（明文仅此一次返回，请妥善保存）。 */
  @Post('keys')
  @OperationLog('开放 API', '签发密钥')
  @RequirePermissions('system:apiKey:add')
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
  @RequirePermissions('system:apiKey:edit')
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
  @RequirePermissions('system:apiKey:edit')
  toggleKey(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.apiKeys.toggleStatus(params.id);
  }

  /** 删除密钥（立即失效）。 */
  @Delete('keys/:id')
  @OperationLog('开放 API', '删除密钥')
  @RequirePermissions('system:apiKey:remove')
  async removeKey(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<null> {
    await this.apiKeys.remove(params.id);
    return null;
  }

  /* ------------------------------- Webhook ------------------------------- */

  /** 订阅列表。 */
  @Get('webhooks')
  @RequirePermissions('system:webhook:query')
  listWebhooks(): Promise<unknown> {
    return this.webhooks.list();
  }

  /** 订阅详情。 */
  @Get('webhooks/:id')
  @RequirePermissions('system:webhook:query')
  detailWebhook(@Param() params: IdParamDto): Promise<unknown> {
    return this.webhooks.detail(params.id);
  }

  /** 新增订阅。 */
  @Post('webhooks')
  @OperationLog('开放 API', '新增 Webhook')
  @RequirePermissions('system:webhook:add')
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
  @RequirePermissions('system:webhook:edit')
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
  @RequirePermissions('system:webhook:remove')
  async removeWebhook(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<null> {
    await this.webhooks.remove(params.id);
    return null;
  }

  /** 手动测试推送（会真的向外部 URL 发一次请求，故按编辑权限控制）。 */
  @Post('webhooks/:id/test')
  @OperationLog('开放 API', '测试 Webhook')
  @RequirePermissions('system:webhook:edit')
  testWebhook(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.webhooks.test(params.id);
  }

  /** 投递记录分页。 */
  @Get('webhook-deliveries')
  @RequirePermissions('system:webhook:query')
  listDeliveries(@Query() query: WebhookDeliveryQueryDto): Promise<unknown> {
    return this.webhooks.listDeliveries(query as unknown as Record<string, unknown>);
  }
}
