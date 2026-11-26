/**
 * API Key（服务账号）服务。
 * 模块职责：密钥签发（只展示一次明文）、列表、启停、删除。
 *
 * 安全口径：
 * - 只存 SHA-256 哈希：库里的行即使整表泄露，也无法逆推密钥调接口；
 * - 明文只在创建响应里出现一次，之后任何接口都不再返回（列表靠 prefix 识别）；
 * - IP 白名单 / 过期 / 停用三道闸在校验路径（AuthGuard）强制执行。
 */
import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppException } from '../../common/exception/app.exception.js';
import { Status } from '../../common/config/constants.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import type { PageResult } from '../../common/types.js';

/** 密钥前缀（明文特征前缀，一眼可辨且防与 JWT 混淆）。 */
const KEY_PREFIX = 'lyak_';
/** 随机部分字节数（base64url 后约 43 字符，熵 ≥ 256 bit）。 */
const KEY_BYTES = 32;

/** 对外 DTO（不含哈希）。 */
export interface ApiKeyItem {
  id: number;
  name: string;
  prefix: string;
  userId: number;
  username: string;
  scopes: string[];
  allowIps: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  status: number;
  remark: string | null;
  createdAt: Date;
}

/** 创建结果（唯一一次包含明文密钥）。 */
export interface ApiKeyCreated extends ApiKeyItem {
  /** 明文密钥，仅此一次返回 */
  key: string;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 分页列表（含所属用户名）。 */
  async list(query: Record<string, unknown>): Promise<PageResult<ApiKeyItem>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const name = readString(query.name);
    const where = name ? { name: { contains: name } } : {};
    const [rows, count] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.apiKey.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      prefix: row.prefix,
      userId: Number(row.userId),
      username: row.user?.username ?? '',
      scopes: readArray(row.scopes),
      allowIps: readArray(row.allowIps),
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
    }));
    return buildPageResult(items, count, page, pageSize);
  }

  /** 详情。 */
  async detail(id: number): Promise<ApiKeyItem> {
    const row = await this.prisma.apiKey.findUnique({
      where: { id: BigInt(id) },
      include: { user: { select: { username: true } } },
    });
    if (!row) {
      throw AppException.notFound('API Key 不存在');
    }
    return {
      id: Number(row.id),
      name: row.name,
      prefix: row.prefix,
      userId: Number(row.userId),
      username: row.user?.username ?? '',
      scopes: readArray(row.scopes),
      allowIps: readArray(row.allowIps),
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
    };
  }

  /**
   * 签发新 Key。
   * @param input userId 必填（Key 以该用户身份调用）；scopes 空 = 同用户权限
   */
  async create(input: {
    name: string;
    userId: number;
    scopes?: string[];
    allowIps?: string[];
    expiresAt?: string | null;
    remark?: string;
  }): Promise<ApiKeyCreated> {
    const name = input.name?.trim();
    if (!name) {
      throw AppException.badRequest('密钥名称不能为空');
    }
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
      throw AppException.badRequest('必须指定所属用户');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(input.userId) },
      select: { id: true, username: true, status: true },
    });
    if (!user) {
      throw AppException.badRequest('所属用户不存在');
    }
    if (Number(user.status) !== Status.ENABLED) {
      throw AppException.badRequest('所属账号已被禁用');
    }
    // 幂等重名保护：同名 Key 会让使用方分不清该旋转哪把
    const existed = await this.prisma.apiKey.findFirst({ where: { name, userId: BigInt(input.userId) } });
    if (existed) {
      throw AppException.conflict('该用户下已存在同名密钥，请先删除或更换名称');
    }
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw AppException.badRequest('过期时间不合法');
    }
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      throw AppException.badRequest('过期时间不能早于当前时间');
    }

    const key = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
    const keyHash = createHash('sha256').update(key).digest('hex');
    const row = await this.prisma.apiKey.create({
      data: {
        name,
        prefix: key.slice(0, KEY_PREFIX.length + 8),
        keyHash,
        userId: BigInt(input.userId),
        scopes: JSON.stringify(input.scopes ?? []),
        allowIps: JSON.stringify(input.allowIps ?? []),
        expiresAt,
        remark: input.remark?.trim() || null,
      },
    });
    this.logger.log(`签发 API Key：${name}（用户 ${user.username}，#${row.id}）`);
    return {
      id: Number(row.id),
      name: row.name,
      prefix: row.prefix,
      userId: Number(row.userId),
      username: user.username,
      scopes: input.scopes ?? [],
      allowIps: input.allowIps ?? [],
      expiresAt: row.expiresAt,
      lastUsedAt: null,
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
      key,
    };
  }

  /** 更新（名称 / 权限范围 / IP / 过期 / 备注；密钥本体不可改，只能轮换）。 */
  async update(
    id: number,
    input: { name?: string; scopes?: string[]; allowIps?: string[]; expiresAt?: string | null; remark?: string },
  ): Promise<ApiKeyItem> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('API Key 不存在');
    }
    const expiresAt = input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null;
    await this.prisma.apiKey.update({
      where: { id: BigInt(id) },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.scopes !== undefined ? { scopes: JSON.stringify(input.scopes) } : {}),
        ...(input.allowIps !== undefined ? { allowIps: JSON.stringify(input.allowIps) } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt } : {}),
        ...(input.remark !== undefined ? { remark: input.remark.trim() || null } : {}),
      },
    });
    return this.detail(id);
  }

  /** 启停。 */
  async toggleStatus(id: number): Promise<ApiKeyItem> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('API Key 不存在');
    }
    await this.prisma.apiKey.update({
      where: { id: BigInt(id) },
      data: { status: Number(existing.status) === Status.ENABLED ? Status.DISABLED : Status.ENABLED },
    });
    return this.detail(id);
  }

  /** 删除（立即失效：哈希行没了，守卫下一步就拒）。 */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('API Key 不存在');
    }
    await this.prisma.apiKey.delete({ where: { id: BigInt(id) } });
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
