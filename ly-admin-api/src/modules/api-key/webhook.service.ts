/**
 * Webhook 外发服务。
 * 模块职责：订阅管理；把站内事件以签名 POST 推送到外部 URL，并落投递记录。
 *
 * 安全与可靠性口径：
 * - 签名密钥信封加密（与 MFA / SSO / 告警同一把钥匙），签名放 X-LY-Signature 头
 *   （`sha256=<hex>`），接收方用同一密钥重算校验，防伪造与篡改；
 * - 投递带超时（5s）、失败不重试爆库：记录 failed 供人工重发；旁路逻辑全部吞异常；
 * - 订阅空 events = 订阅全部事件（常见于内部调试接收端）。
 */
import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import { encryptSecret, decryptSecret, secretsEncryptionAvailable } from '../../common/crypto/secret-box.js';
import { Status } from '../../common/config/constants.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';

/** 投递超时（毫秒）：外部 URL 再慢也不能拖垮发布方。 */
const PUSH_TIMEOUT_MS = 5000;
/** 错误信息截断长度。 */
const ERROR_MAX = 500;

/** 对外 DTO（签名密钥脱敏）。 */
export interface WebhookItem {
  id: number;
  name: string;
  url: string;
  events: string[];
  status: number;
  lastStatus: string | null;
  lastPushAt: Date | null;
  remark: string | null;
  createdAt: Date;
}

/** 投递记录 DTO。 */
export interface WebhookDeliveryItem {
  id: number;
  webhookId: number;
  webhookName?: string;
  event: string;
  payload: unknown;
  statusCode: number;
  status: string;
  error: string | null;
  duration: number;
  createdAt: Date;
}

/** 事件负载。 */
export interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 功能是否可用（未配信封密钥时密钥无法安全落库 → 禁用）。 */
  isEnabled(): boolean {
    return secretsEncryptionAvailable();
  }

  /* -------------------------------- 订阅管理 -------------------------------- */

  /** 订阅列表。 */
  async list(): Promise<WebhookItem[]> {
    const rows = await this.prisma.webhook.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      url: row.url,
      events: readArray(row.events),
      status: Number(row.status),
      lastStatus: row.lastStatus,
      lastPushAt: row.lastPushAt,
      remark: row.remark,
      createdAt: row.createdAt,
    }));
  }

  /** 详情。 */
  async detail(id: number): Promise<WebhookItem> {
    const row = await this.prisma.webhook.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('Webhook 订阅不存在');
    }
    return {
      id: Number(row.id),
      name: row.name,
      url: row.url,
      events: readArray(row.events),
      status: Number(row.status),
      lastStatus: row.lastStatus,
      lastPushAt: row.lastPushAt,
      remark: row.remark,
      createdAt: row.createdAt,
    };
  }

  /** 新增订阅（secret 必填，信封加密）。 */
  async create(input: {
    name: string;
    url: string;
    events?: string[];
    secret: string;
    remark?: string;
  }): Promise<WebhookItem> {
    const name = input.name?.trim();
    const url = input.url?.trim();
    if (!name || !url) {
      throw AppException.badRequest('名称与目标 URL 不能为空');
    }
    if (!/^https?:\/\//.test(url)) {
      throw AppException.badRequest('目标 URL 必须以 http(s):// 开头');
    }
    if (!input.secret?.trim()) {
      throw AppException.badRequest('签名密钥不能为空（接收方用它校验 X-LY-Signature）');
    }
    const row = await this.prisma.webhook.create({
      data: {
        name,
        url,
        events: JSON.stringify(input.events ?? []),
        secret: encryptSecret(input.secret.trim()),
        remark: input.remark?.trim() || null,
      },
    });
    this.logger.log(`新增 Webhook 订阅 ${name} → ${url}`);
    return this.detail(Number(row.id));
  }

  /** 更新订阅（secret 留空 = 不修改）。 */
  async update(
    id: number,
    input: { name?: string; url?: string; events?: string[]; secret?: string; remark?: string; status?: number },
  ): Promise<WebhookItem> {
    const existing = await this.prisma.webhook.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('Webhook 订阅不存在');
    }
    if (input.url !== undefined && !/^https?:\/\//.test(input.url.trim())) {
      throw AppException.badRequest('目标 URL 必须以 http(s):// 开头');
    }
    await this.prisma.webhook.update({
      where: { id: BigInt(id) },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.url !== undefined ? { url: input.url.trim() } : {}),
        ...(input.events !== undefined ? { events: JSON.stringify(input.events) } : {}),
        ...(input.secret?.trim() ? { secret: encryptSecret(input.secret.trim()) } : {}),
        ...(input.remark !== undefined ? { remark: input.remark.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    return this.detail(id);
  }

  /** 删除订阅（投递记录保留供审计）。 */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.webhook.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('Webhook 订阅不存在');
    }
    await this.prisma.webhook.delete({ where: { id: BigInt(id) } });
  }

  /** 手动测试推送（并发一条 webhook.test 事件）。 */
  async test(id: number): Promise<WebhookDeliveryItem> {
    const row = await this.prisma.webhook.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('Webhook 订阅不存在');
    }
    const payload = { webhookId: Number(row.id), name: row.name, time: new Date().toISOString() };
    return this.deliver(row, 'webhook.test', payload);
  }

  /* -------------------------------- 投递记录 -------------------------------- */

  /** 投递记录分页。 */
  async listDeliveries(query: Record<string, unknown>): Promise<PageResult<WebhookDeliveryItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const status = readString(query.status);
    const event = readString(query.event);
    const where = {
      ...(status ? { status } : {}),
      ...(event ? { event: { contains: event } } : {}),
    };
    const [rows, count] = await Promise.all([
      this.prisma.webhookDelivery.findMany({ where, orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: Number(row.id),
      webhookId: Number(row.webhookId),
      event: row.event,
      payload: safeJsonParse(row.payload),
      statusCode: Number(row.statusCode),
      status: row.status,
      error: row.error,
      duration: Number(row.duration),
      createdAt: row.createdAt,
    }));
    return buildPageResult(items, count, page, pageSize);
  }

  /* -------------------------------- 事件入口 -------------------------------- */

  /**
   * 发布事件：向所有订阅了该事件的启用中订阅投递。
   * 任何异常都被吞掉——Webhook 是旁路，绝不能拖垮主业务（如用户创建）。
   */
  async publish(event: WebhookEvent): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    try {
      const rows = await this.prisma.webhook.findMany({ where: { status: Status.ENABLED } });
      const payload = { ...event.data, time: new Date().toISOString() };
      for (const row of rows) {
        const events = readArray(row.events);
        // 空 events = 全部订阅
        if (events.length > 0 && !events.includes(event.event)) {
          continue;
        }
        await this.deliver(row, event.event, payload);
      }
    } catch (error) {
      this.logger.error(
        `Webhook 发布失败（event=${event.event}）：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** 执行一次投递并落记录（内部：row 为 Prisma 实体）。 */
  private async deliver(
    row: { id: bigint; name: string; url: string; secret: string },
    event: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryItem> {
    const body = JSON.stringify({ event, data: payload });
    const startedAt = Date.now();
    let status = 'failed';
    let statusCode = 0;
    let error: string | null = null;
    try {
      const secret = decryptSecret(row.secret);
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      const response = await fetch(row.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LY-Event': event,
          'X-LY-Signature': `sha256=${signature}`,
          'User-Agent': 'LYAdmin-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      statusCode = response.status;
      status = response.ok ? 'ok' : 'failed';
      if (!response.ok) {
        error = `HTTP ${response.status}`;
      }
    } catch (thrown) {
      error = (thrown instanceof Error ? thrown.message : String(thrown)).slice(0, ERROR_MAX);
    }
    const duration = Date.now() - startedAt;
    // 库内 payload 为 JSON 文本；内存里的对象同时用于返回值
    const record = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: row.id,
        event,
        payload: JSON.stringify(payload),
        statusCode,
        status,
        error,
        duration,
      },
    });
    await this.prisma.webhook
      .update({
        where: { id: row.id },
        data: { lastStatus: status, lastPushAt: new Date() },
      })
      .catch(() => undefined);
    if (status === 'failed') {
      this.logger.warn(`Webhook 投递失败（${row.name} #${row.id}，${event}）：${error ?? `HTTP ${statusCode}`}`);
    }
    return {
      id: Number(record.id),
      webhookId: Number(row.id),
      webhookName: row.name,
      event,
      payload,
      statusCode,
      status,
      error,
      duration,
      createdAt: record.createdAt,
    };
  }
}

/** 解析 JSON 字符串数组。 */
function readArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

/** 安全解析 JSON（坏数据归一为 null）。 */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 供控制器引用超时常量（测试用）。 */
export const WEBHOOK_PUSH_TIMEOUT_MS = PUSH_TIMEOUT_MS;
