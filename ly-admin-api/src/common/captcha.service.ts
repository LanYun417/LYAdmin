/**
 * 登录图形验证码服务。
 * 模块职责：生成登录图形验证码（随机字符 + 干扰线/噪点，SVG 经 sharp 光栅化为 PNG），
 * 并以「单次有效 + TTL」的方式保存待校验答案，供登录流程校验。
 *
 * 设计要点（迁移自原 Express 版本）：
 * - **零新增依赖**：用已有的 `sharp` 把 SVG 光栅化为 PNG；相比直接把文字画进 SVG，
 *   可避免验证码以明文形式残留在响应里被直接读取。
 * - **存储降级**：Redis 就绪时用 Redis（跨实例共享）；否则回退进程内 Map（单实例）。
 * - **单次有效**：校验时「取出即删除」，同一验证码不可复用。
 */
import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { config } from './config.js';
import { RedisService } from './redis.service.js';
import type { CaptchaResult } from './types.js';

/** 字符集：剔除易混淆的 0/O/1/I 等，降低正常用户误输。 */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 图片尺寸（px）。 */
const WIDTH = 120;
const HEIGHT = 40;

/** Redis 键前缀。 */
const REDIS_KEY_PREFIX = 'auth:captcha:';

/** 干扰线 / 噪点配色（浅色，作为背景杂色）。 */
const NOISE_COLORS = ['#94a3b8', '#a5b4fc', '#f9a8d4', '#7dd3fc', '#fca5a5', '#86efac'];
/** 字符配色（深色，保证可读）。 */
const CHAR_COLORS = ['#1e293b', '#334155', '#1d4ed8', '#0f766e', '#7c2d12'];

/** 进程内回退存储（单实例；带过期时间）。 */
const memoryStore = new Map<string, { code: string; expiresAt: number }>();

/** 清理过期内存项，避免 Map 无限增长。 */
function cleanupMemory(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore) {
    if (value.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
}

/** 生成随机验证码文本。 */
function randomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}

/** 生成含随机颜色、逐字旋转/偏移、干扰线与噪点的验证码 SVG。 */
function buildSvg(code: string): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#f1f5fb"/>`,
  ];

  // 干扰线
  for (let i = 0; i < 5; i += 1) {
    const color = NOISE_COLORS[randomInt(NOISE_COLORS.length)];
    parts.push(
      `<line x1="${randomInt(WIDTH)}" y1="${randomInt(HEIGHT)}" x2="${randomInt(WIDTH)}" y2="${randomInt(HEIGHT)}" stroke="${color}" stroke-width="1"/>`,
    );
  }
  // 噪点
  for (let i = 0; i < 30; i += 1) {
    const color = NOISE_COLORS[randomInt(NOISE_COLORS.length)];
    parts.push(`<circle cx="${randomInt(WIDTH)}" cy="${randomInt(HEIGHT)}" r="1" fill="${color}"/>`);
  }
  // 字符：逐字随机旋转 / 偏移，降低机器识别成功率
  const step = (WIDTH - 16) / code.length;
  code.split('').forEach((char, index) => {
    const x = 8 + Math.round(step * index) + randomInt(4);
    const y = 29 + randomInt(5);
    const angle = randomInt(31) - 15;
    const color = CHAR_COLORS[randomInt(CHAR_COLORS.length)];
    parts.push(
      `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="${color}" transform="rotate(${angle} ${x} ${y})">${char}</text>`,
    );
  });

  parts.push('</svg>');
  return parts.join('');
}

@Injectable()
export class CaptchaService {
  constructor(private readonly redis: RedisService) {}

  /** 保存验证码答案（Redis 优先，失败降级内存）。 */
  private async saveCaptchaCode(id: string, code: string): Promise<void> {
    if (this.redis.isReady()) {
      const ok = await this.redis.set(`${REDIS_KEY_PREFIX}${id}`, code, config.captcha.ttlMs);
      if (ok) {
        return;
      }
    }
    cleanupMemory();
    memoryStore.set(id, { code, expiresAt: Date.now() + config.captcha.ttlMs });
  }

  /** 取出并删除验证码答案（单次有效）。 */
  private async takeCaptchaCode(id: string): Promise<string | null> {
    if (this.redis.isReady()) {
      const code = await this.redis.get(`${REDIS_KEY_PREFIX}${id}`);
      if (code) {
        await this.redis.del(`${REDIS_KEY_PREFIX}${id}`);
        return code;
      }
    }
    const entry = memoryStore.get(id);
    if (!entry) {
      return null;
    }
    memoryStore.delete(id);
    return entry.expiresAt < Date.now() ? null : entry.code;
  }

  /**
   * 生成一张验证码。
   * @returns `{ enabled, captchaId, image }`；验证码关闭时 `enabled=false` 且后两者为 null
   */
  async createCaptcha(): Promise<CaptchaResult> {
    if (!config.captcha.enabled) {
      return { enabled: false, captchaId: null, image: null };
    }
    const code = randomCode(config.captcha.length);
    const captchaId = randomUUID();
    const png = await sharp(Buffer.from(buildSvg(code)))
      .png()
      .toBuffer();
    await this.saveCaptchaCode(captchaId, code);
    return { enabled: true, captchaId, image: `data:image/png;base64,${png.toString('base64')}` };
  }

  /**
   * 校验验证码（单次有效、大小写不敏感）。
   * @returns 是否通过；验证码功能关闭时恒为 `true`
   */
  async verifyCaptcha(captchaId?: string, captchaCode?: string): Promise<boolean> {
    if (!config.captcha.enabled) {
      return true;
    }
    if (!captchaId || !captchaCode) {
      return false;
    }
    const expected = await this.takeCaptchaCode(captchaId);
    return expected !== null && expected.toLowerCase() === captchaCode.trim().toLowerCase();
  }
}
