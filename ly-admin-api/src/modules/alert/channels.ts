/**
 * 告警渠道分发器。
 * 模块职责：把一条告警按渠道类型发出去（邮件 / Webhook / 钉钉 / 企业微信 / 飞书）。
 *
 * 设计取舍：
 * - 除邮件外全部走 `fetch` + 自定义超时（AbortSignal.timeout）——零新增依赖；
 * - 邮件是唯一需要 SMTP 客户端的能力，引入 nodemailer（社区标准实现，TLS/AUTH 自己抠细节不划算）；
 * - 每个分发函数只返回 `{ ok, error }`，不抛错——投递结果统一由 AlertService 落库。
 */
import { createHmac } from 'node:crypto';
import { createTransport, type Transporter } from 'nodemailer';
import { config } from '../../common/config/config.js';
import { decryptSecret } from '../../common/crypto/secret-box.js';

/** 渠道配置（敏感字段为信封密文；明文字段直接可读）。 */
export interface ChannelConfig {
  /** 邮件：SMTP 参数 */
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  /** 信封密文 */
  pass?: string;
  from?: string;
  /** 收件人（逗号分隔） */
  to?: string;
  /** Webhook 类：URL 与可选签名密钥（信封密文） */
  url?: string;
  webhook?: string;
  secret?: string;
}

/** 告警内容（各渠道统一输入）。 */
export interface AlertMessage {
  title: string;
  message: string;
  level: string;
}

/** 投递结果。 */
export interface SendResult {
  ok: boolean;
  error?: string;
}

/** 超时signal（毫秒）。 */
function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(config.alert.channelTimeoutSeconds * 1000);
}

/** 组装全文（标题 + 内容 + 级别 + 时间）。 */
function fullText(alert: AlertMessage): string {
  return `[${alert.level.toUpperCase()}] ${alert.title}\n${alert.message}\n时间：${new Date().toLocaleString('zh-CN')}`;
}

/* ------------------------------- 邮件渠道 ------------------------------- */

let mailTransporter: Transporter | null = null;

/** 按渠道配置创建（并缓存）SMTP 传输器。 */
function mailTransport(cfg: ChannelConfig): Transporter {
  mailTransporter ??= createTransport({
    host: cfg.host,
    port: cfg.port ?? 465,
    secure: cfg.secure ?? true,
    auth: cfg.user ? { user: cfg.user, pass: decryptSecret(cfg.pass ?? '') } : undefined,
  });
  return mailTransporter;
}

async function sendEmail(cfg: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  if (!cfg.host || !cfg.to) {
    return { ok: false, error: '邮件渠道缺少 host 或收件人' };
  }
  const transport = mailTransport(cfg);
  await transport.sendMail({
    from: cfg.from || config.alert.mailFrom || cfg.user,
    to: cfg.to,
    subject: `[LYAdmin] ${alert.title}`,
    text: fullText(alert),
  });
  return { ok: true };
}

/* ------------------------------ Webhook 渠道 ------------------------------ */

/** Webhook 签名（HMAC-SHA256，hex）：配置了密钥时下发 X-Signature 头。 */
function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function sendWebhook(cfg: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  const url = cfg.url;
  if (!url) {
    return { ok: false, error: 'Webhook 渠道缺少 url' };
  }
  const body = JSON.stringify({
    title: alert.title,
    message: alert.message,
    level: alert.level,
    text: fullText(alert),
    time: new Date().toISOString(),
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.secret) {
    headers['X-Signature'] = signBody(decryptSecret(cfg.secret), body);
  }
  const response = await fetch(url, { method: 'POST', headers, body, signal: timeoutSignal() });
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  return { ok: true };
}

/* --------------------- 钉钉 / 企业微信 / 飞书（文本消息） --------------------- */

async function sendDingTalk(cfg: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  const webhook = cfg.webhook;
  if (!webhook) {
    return { ok: false, error: '钉钉渠道缺少 webhook' };
  }
  const body = JSON.stringify({ msgtype: 'text', text: { content: fullText(alert) } });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.secret) {
    // 钉钉机器人加签：timestamp\nsecret 的 HMAC-SHA256 再 URL 编码
    const timestamp = Date.now();
    const sign = encodeURIComponent(
      createHmac('sha256', decryptSecret(cfg.secret))
        .update(`${timestamp}\n${decryptSecret(cfg.secret)}`)
        .digest('base64'),
    );
    const url = `${webhook}${webhook.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${sign}`;
    const response = await fetch(url, { method: 'POST', headers, body, signal: timeoutSignal() });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  }
  const response = await fetch(webhook, { method: 'POST', headers, body, signal: timeoutSignal() });
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  return { ok: true };
}

async function sendWeCom(cfg: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  const webhook = cfg.webhook;
  if (!webhook) {
    return { ok: false, error: '企业微信渠道缺少 webhook' };
  }
  const body = JSON.stringify({ msgtype: 'text', text: { content: fullText(alert) } });
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: timeoutSignal(),
  });
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  const parsed = (await response.json().catch(() => ({}))) as { errcode?: number; errmsg?: string };
  if (parsed.errcode && parsed.errcode !== 0) {
    return { ok: false, error: parsed.errmsg || `errcode ${parsed.errcode}` };
  }
  return { ok: true };
}

async function sendFeishu(cfg: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  const webhook = cfg.webhook;
  if (!webhook) {
    return { ok: false, error: '飞书渠道缺少 webhook' };
  }
  const body = JSON.stringify({ msg_type: 'text', content: { text: fullText(alert) } });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.secret) {
    // 飞书自定义机器人签名：timestamp\nsecret 的 HMAC-SHA256，base64 后作 sign 参数
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = createHmac('sha256', decryptSecret(cfg.secret))
      .update(`${timestamp}\n${decryptSecret(cfg.secret)}`)
      .digest('base64');
    const url = `${webhook}${webhook.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    const response = await fetch(url, { method: 'POST', headers, body, signal: timeoutSignal() });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  }
  const response = await fetch(webhook, { method: 'POST', headers, body, signal: timeoutSignal() });
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }
  const parsed = (await response.json().catch(() => ({}))) as { code?: number; msg?: string };
  if (parsed.code && parsed.code !== 0) {
    return { ok: false, error: parsed.msg || `code ${parsed.code}` };
  }
  return { ok: true };
}

/** 按渠道类型分发；未知类型返回失败结果（不抛错）。 */
export async function sendAlert(type: string, channelConfig: ChannelConfig, alert: AlertMessage): Promise<SendResult> {
  try {
    switch (type) {
      case 'email':
        return await sendEmail(channelConfig, alert);
      case 'webhook':
        return await sendWebhook(channelConfig, alert);
      case 'dingtalk':
        return await sendDingTalk(channelConfig, alert);
      case 'wecom':
        return await sendWeCom(channelConfig, alert);
      case 'feishu':
        return await sendFeishu(channelConfig, alert);
      default:
        return { ok: false, error: `未知渠道类型：${type}` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 测试 SMTP 连接（渠道保存前的连通性校验）。 */
export async function verifyEmailChannel(channelConfig: ChannelConfig): Promise<SendResult> {
  try {
    if (!channelConfig.host) {
      return { ok: false, error: '缺少 SMTP host' };
    }
    await mailTransport(channelConfig).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
