/**
 * 告警中心服务。
 * 模块职责：渠道 / 规则配置管理、事件→规则匹配→冷却→投递→落库的全流程。
 *
 * 关键口径：
 * - **级别匹配**：事件级别必须 ≥ 规则级别（critical 事件会触发 warning/info 规则的订阅）；
 * - **冷却去重**：同一规则 + 同一去重键在 cooldownSeconds 内只告警一次（Redis 计数，
 *   不可用时降级为不冷却——宁可多发一条，也不静默丢告警）；
 * - **投递不抛错**：任何渠道失败只落库不抛出，业务主流程（如导出任务）绝不因告警失败而失败；
 * - **敏感字段信封加密**：SMTP 口令 / 加签密钥加密后入库，下发时解密。
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { encryptSecret, decryptSecret, secretsEncryptionAvailable } from '../../common/crypto/secret-box.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import { sendAlert, verifyEmailChannel, type AlertMessage, type ChannelConfig } from './channels.js';
import type { PageResult } from '../../common/types.js';

/**
 * 安全字符串化：仅接受 string / number / boolean，其余一律回退默认值。
 * oxlint 的 no-base-to-string 要求：Record<string, unknown> 上的字段不能直接 String()。
 */
function toSafeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

/** 告警级别（数值越大越严重）。 */
const LEVELS: Record<string, number> = { info: 1, warning: 2, critical: 3 };
/** 支持的渠道类型。 */
export const CHANNEL_TYPES = ['email', 'webhook', 'dingtalk', 'wecom', 'feishu'] as const;
/** 各渠道需要加密的配置字段。 */
const SECRET_FIELDS: Record<string, string[]> = {
  email: ['pass'],
  webhook: ['secret'],
  dingtalk: ['secret'],
  wecom: [],
  feishu: ['secret'],
};

/** 告警事件输入。 */
export interface AlertEvent {
  /** 事件类型（如 export.failed） */
  eventType: string;
  /** 级别：info / warning / critical */
  level: string;
  /** 标题 */
  title: string;
  /** 内容 */
  message: string;
  /** 附加负载（JSON 序列化后入库） */
  payload?: Record<string, unknown>;
  /** 冷却去重键（缺省用 eventType；如同一任务反复失败可按任务 id 去重） */
  dedupKey?: string;
}

/** 渠道对外 DTO（敏感字段脱敏：只标注「已设置」）。 */
export interface AlertChannelItem {
  id: number;
  type: string;
  name: string;
  config: Record<string, unknown>;
  status: number;
  sort: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 规则对外 DTO。 */
export interface AlertRuleItem {
  id: number;
  name: string;
  eventType: string;
  level: string;
  channelIds: number[];
  cooldownSeconds: number;
  status: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 投递记录对外 DTO。 */
export interface AlertRecordItem {
  id: number;
  ruleId: number;
  ruleName: string;
  eventType: string;
  level: string;
  title: string;
  message: string;
  channelIds: number[];
  status: string;
  results: Record<string, { ok: boolean; error?: string }> | null;
  retries: number;
  createdAt: Date;
  sentAt: Date | null;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** 功能是否可用（未配信封密钥时渠道配置无法安全落库 → 整体禁用）。 */
  isEnabled(): boolean {
    return secretsEncryptionAvailable();
  }

  /* -------------------------------- 渠道 CRUD -------------------------------- */

  /** 渠道列表（敏感字段脱敏）。 */
  async listChannels(): Promise<AlertChannelItem[]> {
    const rows = await this.prisma.alertChannel.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    return rows.map((row) => ({
      id: Number(row.id),
      type: row.type,
      name: row.name,
      config: this.maskConfig(row.type, row.config),
      status: Number(row.status),
      sort: Number(row.sort),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /** 渠道详情（敏感字段脱敏；不存在抛 404）。 */
  async getChannel(id: number): Promise<AlertChannelItem> {
    const row = await this.prisma.alertChannel.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('告警渠道不存在');
    }
    return this.channelItem(row);
  }

  /** 新增渠道（敏感字段信封加密）。 */
  async createChannel(input: Record<string, unknown>, operatorId: number): Promise<AlertChannelItem> {
    const { type, name, config, status, sort, remark } = this.readChannelInput(input);
    const row = await this.prisma.alertChannel.create({
      data: {
        type,
        name,
        config: this.encryptConfig(type, config),
        status,
        sort,
        remark,
      },
    });
    this.logger.log(`操作者 ${operatorId} 新增告警渠道 ${name}（${type}）`);
    return this.channelItem(row);
  }

  /** 更新渠道。 */
  async updateChannel(id: number, input: Record<string, unknown>, operatorId: number): Promise<AlertChannelItem> {
    const existing = await this.prisma.alertChannel.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('告警渠道不存在');
    }
    const { type, name, config, status, sort, remark } = this.readChannelInput(input);
    // 更新时未提供的敏感字段保留原密文（不要求用户每次都重填密钥）
    const merged = this.mergeSecretFields(type, existing.config, config);
    await this.prisma.alertChannel.update({
      where: { id: BigInt(id) },
      data: { type, name, config: this.encryptConfig(type, merged), status, sort, remark },
    });
    this.logger.log(`操作者 ${operatorId} 更新告警渠道 ${name}（${type}）`);
    return this.channelItem(await this.prisma.alertChannel.findUniqueOrThrow({ where: { id: BigInt(id) } }));
  }

  /** 删除渠道（规则里的引用由投递时过滤，不级联删规则）。 */
  async deleteChannel(id: number, operatorId: number): Promise<void> {
    const existing = await this.prisma.alertChannel.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('告警渠道不存在');
    }
    await this.prisma.alertChannel.delete({ where: { id: BigInt(id) } });
    this.logger.log(`操作者 ${operatorId} 删除告警渠道 ${existing.name}`);
  }

  /** 测试发送：立即向该渠道投递一条测试告警并落库。 */
  async testChannel(id: number, operatorId: number): Promise<AlertRecordItem> {
    const row = await this.prisma.alertChannel.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('告警渠道不存在');
    }
    if (row.type === 'email') {
      const verified = await verifyEmailChannel(this.decryptConfig(row.type, row.config));
      if (!verified.ok) {
        throw AppException.badRequest(`SMTP 连通性校验失败：${verified.error ?? '未知原因'}`);
      }
    }
    this.logger.log(`操作者 ${operatorId} 测试告警渠道 ${row.name}`);
    return this.dispatch(
      '手动测试',
      {
        eventType: 'alert.test',
        level: 'info',
        title: 'LYAdmin 告警渠道测试',
        message: `这是一条测试告警（渠道：${row.name}）。收到即表示链路畅通。`,
      },
      [Number(row.id)],
    );
  }

  /* -------------------------------- 规则 CRUD -------------------------------- */

  /** 规则列表。 */
  async listRules(): Promise<AlertRuleItem[]> {
    const rows = await this.prisma.alertRule.findMany({ orderBy: [{ id: 'asc' }] });
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      eventType: row.eventType,
      level: row.level,
      channelIds: this.readIds(row.channelIds),
      cooldownSeconds: Number(row.cooldownSeconds),
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /** 新增规则。 */
  async createRule(input: Record<string, unknown>, operatorId: number): Promise<AlertRuleItem> {
    const data = this.readRuleInput(input);
    await this.assertChannelsExist(data.channelIds);
    const row = await this.prisma.alertRule.create({
      data: {
        name: data.name,
        eventType: data.eventType,
        level: data.level,
        channelIds: JSON.stringify(data.channelIds),
        cooldownSeconds: data.cooldownSeconds,
        status: data.status,
        remark: data.remark,
      },
    });
    this.logger.log(`操作者 ${operatorId} 新增告警规则 ${data.name}`);
    return this.ruleItem(row);
  }

  /** 更新规则。 */
  async updateRule(id: number, input: Record<string, unknown>, operatorId: number): Promise<AlertRuleItem> {
    const existing = await this.prisma.alertRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('告警规则不存在');
    }
    const data = this.readRuleInput(input);
    await this.assertChannelsExist(data.channelIds);
    await this.prisma.alertRule.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        eventType: data.eventType,
        level: data.level,
        channelIds: JSON.stringify(data.channelIds),
        cooldownSeconds: data.cooldownSeconds,
        status: data.status,
        remark: data.remark,
      },
    });
    this.logger.log(`操作者 ${operatorId} 更新告警规则 ${data.name}`);
    return this.ruleItem(await this.prisma.alertRule.findUniqueOrThrow({ where: { id: BigInt(id) } }));
  }

  /** 删除规则。 */
  async deleteRule(id: number, operatorId: number): Promise<void> {
    const existing = await this.prisma.alertRule.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('告警规则不存在');
    }
    await this.prisma.alertRule.delete({ where: { id: BigInt(id) } });
    this.logger.log(`操作者 ${operatorId} 删除告警规则 ${existing.name}`);
  }

  /* ------------------------------ 记录与重试 ------------------------------ */

  /** 投递记录分页列表。 */
  async listRecords(query: Record<string, unknown>): Promise<PageResult<AlertRecordItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const status = readString(query.status);
    const eventType = readString(query.eventType);
    const where = {
      ...(status ? { status } : {}),
      ...(eventType ? { eventType: { contains: eventType } } : {}),
    };
    const [rows, count] = await Promise.all([
      this.prisma.alertRecord.findMany({ where, orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.alertRecord.count({ where }),
    ]);
    const items = rows.map((row) => this.recordItem(row));
    return buildPageResult(items, count, page, pageSize);
  }

  /** 重试一条失败的投递记录（原渠道集合）。 */
  async retryRecord(id: number, operatorId: number): Promise<AlertRecordItem> {
    const row = await this.prisma.alertRecord.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('告警记录不存在');
    }
    this.logger.log(`操作者 ${operatorId} 重试告警记录 ${id}`);
    return this.dispatch(
      row.ruleName,
      {
        eventType: row.eventType,
        level: row.level,
        title: row.title,
        message: row.message,
      },
      this.readIds(row.channelIds),
      Number(row.id),
    );
  }

  /* -------------------------------- 事件入口 -------------------------------- */

  /**
   * 发布一个告警事件：匹配规则 → 冷却 → 投递 → 落库。
   * 任何异常都被吞掉并记录日志——告警是旁路，绝不能拖垮主业务。
   */
  async publish(event: AlertEvent): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    try {
      const eventLevel = LEVELS[event.level] ?? LEVELS.info;
      const rules = await this.prisma.alertRule.findMany({
        where: { status: 1, eventType: event.eventType },
      });
      for (const rule of rules) {
        // 级别匹配：事件级别 ≥ 规则订阅级别
        if ((LEVELS[rule.level] ?? LEVELS.info) > eventLevel) {
          continue;
        }
        // 冷却去重：NX 语义（窗口内只放行第一个）。Redis 不可用时 setNx 返回 false，
        // 此时**放行**（宁可多发一条，也不静默丢告警）
        const cooldownKey = `alert:cooldown:${rule.id}:${event.dedupKey ?? event.eventType}`;
        const first = await this.redis.setNx(cooldownKey, '1', Number(rule.cooldownSeconds) * 1000);
        if (!first && this.redis.isReady()) {
          continue;
        }
        await this.dispatch(
          rule.name,
          event,
          this.readIds(rule.channelIds),
          undefined,
          JSON.stringify({
            ruleId: Number(rule.id),
            ...event.payload,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `告警发布失败（event=${event.eventType}）：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /* -------------------------------- 内部实现 -------------------------------- */

  /** 执行一次投递并落库（新建或更新记录）。 */
  private async dispatch(
    ruleName: string,
    event: Pick<AlertEvent, 'eventType' | 'level' | 'title' | 'message'>,
    channelIds: number[],
    existingRecordId?: number,
    payload?: string,
  ): Promise<AlertRecordItem> {
    const alert: AlertMessage = { title: event.title, message: event.message, level: event.level };
    // 只投递给启用中的渠道（规则引用了已删/停用渠道时静默跳过）
    const channels = channelIds.length
      ? await this.prisma.alertChannel.findMany({
          where: { id: { in: channelIds.map((id) => BigInt(id)) }, status: 1 },
          orderBy: { id: 'asc' },
        })
      : [];

    const record = existingRecordId
      ? await this.prisma.alertRecord.update({
          where: { id: BigInt(existingRecordId) },
          data: { status: 'pending', retries: { increment: 1 } },
        })
      : await this.prisma.alertRecord.create({
          data: {
            ruleId: existingRecordId ? undefined : 0,
            ruleName,
            eventType: event.eventType,
            level: event.level,
            title: event.title,
            message: event.message,
            payload: payload ?? null,
            channelIds: JSON.stringify(channelIds),
            status: 'pending',
          },
        });

    const results: Record<string, { ok: boolean; error?: string }> = {};
    let anyOk = false;
    for (const channel of channels) {
      const result = await sendAlert(channel.type, this.decryptConfig(channel.type, channel.config), alert);
      results[String(channel.id)] = result;
      if (result.ok) {
        anyOk = true;
      }
    }

    const status = channels.length === 0 ? 'failed' : anyOk ? 'sent' : 'failed';
    const updated = await this.prisma.alertRecord.update({
      where: { id: record.id },
      data: { status, results: JSON.stringify(results), sentAt: new Date() },
    });
    if (status === 'failed') {
      this.logger.warn(`告警投递失败（record=${updated.id}）：${JSON.stringify(results)}`);
    }
    return this.recordItem(updated);
  }

  /** 读取并校验渠道输入。 */
  private readChannelInput(input: Record<string, unknown>): {
    type: string;
    name: string;
    config: Record<string, string>;
    status: number;
    sort: number;
    remark: string | null;
  } {
    const type = toSafeString(input.type);
    const name = toSafeString(input.name).trim();
    if (!CHANNEL_TYPES.includes(type as (typeof CHANNEL_TYPES)[number])) {
      throw AppException.badRequest(`不支持的渠道类型：${type}`);
    }
    if (!name) {
      throw AppException.badRequest('渠道名称不能为空');
    }
    const rawConfig = input.config;
    if (rawConfig !== undefined && typeof rawConfig !== 'object') {
      throw AppException.badRequest('config 必须是 JSON 对象');
    }
    const config: Record<string, string> = {};
    for (const [key, value] of Object.entries((rawConfig ?? {}) as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        config[key] = String(value);
      }
    }
    this.assertChannelConfig(type, config);
    return {
      type,
      name,
      config,
      status: input.status === undefined ? 1 : Number(input.status),
      sort: input.sort === undefined ? 0 : Number(input.sort),
      remark: (typeof input.remark === 'string' && input.remark.trim()) || null,
    };
  }

  /** 渠道配置必填项校验（邮件收件人、Webhook URL 等）。 */
  private assertChannelConfig(type: string, config: Record<string, string>): void {
    if (type === 'email') {
      if (!config.host || !config.to) {
        throw AppException.badRequest('邮件渠道必须提供 host 与收件人 to');
      }
      return;
    }
    const urlKey = type === 'webhook' ? 'url' : 'webhook';
    if (!config[urlKey]) {
      throw AppException.badRequest(`${type} 渠道必须提供 ${urlKey}`);
    }
  }

  /** 加密敏感字段（仅当值是明文时；已是 v1: 密文的跳过）。 */
  private encryptConfig(type: string, config: Record<string, string>): string {
    const fields = SECRET_FIELDS[type] ?? [];
    const out = { ...config };
    for (const field of fields) {
      const value = out[field];
      if (value && !value.startsWith('v1:')) {
        out[field] = encryptSecret(value);
      }
    }
    return JSON.stringify(out);
  }

  /** 解密敏感字段（下发时用）。 */
  private decryptConfig(type: string, raw: string): ChannelConfig {
    const fields = SECRET_FIELDS[type] ?? [];
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = { ...parsed };
    for (const field of fields) {
      const value = out[field];
      if (value?.startsWith('v1:')) {
        out[field] = decryptSecret(value);
      }
    }
    return out;
  }

  /** 脱敏输出：敏感字段只标注是否已设置。 */
  private maskConfig(type: string, raw: string): Record<string, unknown> {
    const fields = new Set(SECRET_FIELDS[type] ?? []);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      out[key] = fields.has(key) ? (value ? '***' : '') : value;
    }
    return out;
  }

  /** 更新时合并敏感字段：新值缺省 / 空串 → 保留原密文。 */
  private mergeSecretFields(
    type: string,
    existingRaw: string,
    incoming: Record<string, string>,
  ): Record<string, string> {
    const fields = SECRET_FIELDS[type] ?? [];
    const existing = JSON.parse(existingRaw) as Record<string, string>;
    const merged = { ...existing, ...incoming };
    for (const field of fields) {
      const value = incoming[field];
      if (!value) {
        merged[field] = existing[field] ?? '';
      }
    }
    return merged;
  }

  /** 读取并校验规则输入。 */
  private readRuleInput(input: Record<string, unknown>): {
    name: string;
    eventType: string;
    level: string;
    channelIds: number[];
    cooldownSeconds: number;
    status: number;
    remark: string | null;
  } {
    const name = toSafeString(input.name).trim();
    const eventType = toSafeString(input.eventType).trim();
    const level = toSafeString(input.level, 'warning');
    if (!name) {
      throw AppException.badRequest('规则名称不能为空');
    }
    if (!eventType) {
      throw AppException.badRequest('事件类型不能为空');
    }
    if (!(level in LEVELS)) {
      throw AppException.badRequest(`不支持的告警级别：${level}`);
    }
    const channelIds = Array.isArray(input.channelIds)
      ? input.channelIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (!channelIds.length) {
      throw AppException.badRequest('至少选择一个通知渠道');
    }
    const cooldownSeconds = input.cooldownSeconds === undefined ? 300 : Math.max(0, Number(input.cooldownSeconds));
    return {
      name,
      eventType,
      level,
      channelIds,
      cooldownSeconds,
      status: input.status === undefined ? 1 : Number(input.status),
      remark: (typeof input.remark === 'string' && input.remark.trim()) || null,
    };
  }

  /** 校验渠道 id 都存在。 */
  private async assertChannelsExist(channelIds: number[]): Promise<void> {
    const count = await this.prisma.alertChannel.count({ where: { id: { in: channelIds.map((id) => BigInt(id)) } } });
    if (count !== channelIds.length) {
      throw AppException.badRequest('引用的通知渠道不存在');
    }
  }

  /** 解析 JSON id 数组。 */
  private readIds(raw: string): number[] {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id)) : [];
    } catch {
      return [];
    }
  }

  private async channelItem(row: {
    id: bigint;
    type: string;
    name: string;
    config: string;
    status: number;
    sort: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AlertChannelItem> {
    return {
      id: Number(row.id),
      type: row.type,
      name: row.name,
      config: this.maskConfig(row.type, row.config),
      status: Number(row.status),
      sort: Number(row.sort),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private ruleItem(row: {
    id: bigint;
    name: string;
    eventType: string;
    level: string;
    channelIds: string;
    cooldownSeconds: number;
    status: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AlertRuleItem {
    return {
      id: Number(row.id),
      name: row.name,
      eventType: row.eventType,
      level: row.level,
      channelIds: this.readIds(row.channelIds),
      cooldownSeconds: Number(row.cooldownSeconds),
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private recordItem(row: {
    id: bigint;
    ruleId: bigint;
    ruleName: string;
    eventType: string;
    level: string;
    title: string;
    message: string;
    channelIds: string;
    status: string;
    results: string | null;
    retries: number;
    createdAt: Date;
    sentAt: Date | null;
  }): AlertRecordItem {
    let results: AlertRecordItem['results'] = null;
    if (row.results) {
      try {
        results = JSON.parse(row.results);
      } catch {
        results = null;
      }
    }
    return {
      id: Number(row.id),
      ruleId: Number(row.ruleId),
      ruleName: row.ruleName,
      eventType: row.eventType,
      level: row.level,
      title: row.title,
      message: row.message,
      channelIds: this.readIds(row.channelIds),
      status: row.status,
      results,
      retries: Number(row.retries),
      createdAt: row.createdAt,
      sentAt: row.sentAt,
    };
  }
}
