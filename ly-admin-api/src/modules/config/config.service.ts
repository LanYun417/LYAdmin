/**
 * 参数模块约定：
 * - `configKey` 即业务引用键，创建后不可修改（编辑 DTO 不含该字段）；
 * - `systemFlag=1` 的内置参数禁止删除（防止误删导致依赖方退化为默认行为），但值可改；
 * - 参数不参与鉴权缓存，变更无需清理鉴权缓存（与角色/菜单不同）；
 * - **取值走进程内缓存**（见 getConfigData）：参数表行数极少、读多写少，
 *   登录链路每次读 2 个键，不缓存等于每次登录白送 2 次查询。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import { recordAfter, recordBefore } from '../../common/log/operation-snapshot.js';
import type { CreateConfigDto, UpdateConfigDto } from './dto/config.dto.js';

/** 参数（对外 DTO）。 */
export interface SysConfigBrief {
  id: number;
  configName: string;
  configKey: string;
  configValue: string;
  systemFlag: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 业务侧按值取数（精简）。 */
export interface ConfigData {
  configKey: string;
  configValue: string;
}

/**
 * 取值缓存 TTL（毫秒）。短 TTL + 写后失效双保险：
 * 单实例内严格一致，多实例最坏 5 秒延迟（参数调整本就是低频运维动作，可接受）。
 */
const CONFIG_CACHE_TTL_MS = 5000;

@Injectable()
export class ConfigService {
  /**
   * 按 key 的取值缓存。
   * value 为 null 表示「键不存在」的否定缓存——防止不存在的键被反复查询（如拼错的 key）。
   */
  private readonly cache = new Map<string, { value: string | null; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Prisma 参数记录 → SysConfigBrief DTO。 */
  private toSysConfigBrief(row: {
    id: bigint;
    configName: string;
    configKey: string;
    configValue: string;
    systemFlag: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SysConfigBrief {
    return {
      id: Number(row.id),
      configName: row.configName,
      configKey: row.configKey,
      configValue: row.configValue,
      systemFlag: Number(row.systemFlag),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * 分页查询参数。
   * @param query 查询参数（page/pageSize/configName/configKey）
   */
  async listConfigs(query: Record<string, unknown>): Promise<PageResult<SysConfigBrief>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const configName = readString(query.configName);
    const configKey = readString(query.configKey);

    const rows = await this.prisma.sysConfig.findMany({
      where: {
        ...(configName ? { configName: { contains: configName } } : {}),
        ...(configKey ? { configKey: { contains: configKey } } : {}),
      },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
    });
    const count = await this.prisma.sysConfig.count({
      where: {
        ...(configName ? { configName: { contains: configName } } : {}),
        ...(configKey ? { configKey: { contains: configKey } } : {}),
      },
    });

    return buildPageResult(
      rows.map((row) => this.toSysConfigBrief(row)),
      count,
      page,
      pageSize,
    );
  }

  /** 参数详情。 */
  async getConfigDetail(id: number): Promise<SysConfigBrief> {
    const row = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!row) {
      throw AppException.notFound('参数不存在');
    }
    return this.toSysConfigBrief(row);
  }

  /**
   * 按键取参数值（业务取数，仅需登录）。
   *
   * 进程内缓存 + 写后失效：命中即省一次数据库往返。缓存只存「键 → 值」最小信息，
   * 过期时间短（5s），避免参数调整后多实例延迟带来预期外行为。
   * @param configKey 参数键名
   * @returns 键值对；键不存在时返回 null
   */
  async getConfigData(configKey: string): Promise<ConfigData | null> {
    const cached = this.readCache(configKey);
    if (cached !== undefined) {
      return cached === null ? null : { configKey, configValue: cached };
    }
    const row = await this.prisma.sysConfig.findUnique({ where: { configKey } });
    this.writeCache(configKey, row?.configValue ?? null);
    if (!row) {
      return null;
    }
    return { configKey: row.configKey, configValue: row.configValue };
  }

  /** 读缓存：未命中 / 已过期返回 undefined（由调用方查库）。 */
  private readCache(configKey: string): string | null | undefined {
    const entry = this.cache.get(configKey);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(configKey);
      return undefined;
    }
    return entry.value;
  }

  /** 写缓存（含否定缓存）。 */
  private writeCache(configKey: string, value: string | null): void {
    this.cache.set(configKey, { value, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  }

  /** 写操作后立即失效对应键，保证同一进程内读到新值。 */
  private invalidate(configKey: string): void {
    this.cache.delete(configKey);
  }

  /** 新增参数。 */
  async createConfig(input: CreateConfigDto): Promise<SysConfigBrief> {
    const exists = await this.prisma.sysConfig.findUnique({ where: { configKey: input.configKey } });
    if (exists) {
      throw AppException.conflict('参数键名已存在');
    }
    const row = await this.prisma.sysConfig.create({
      data: {
        configName: input.configName,
        configKey: input.configKey,
        configValue: input.configValue ?? '',
        systemFlag: 0,
        remark: input.remark || null,
      },
    });
    this.invalidate(input.configKey);
    return this.toSysConfigBrief(row);
  }

  /** 编辑参数（键名不可改，内置参数仅可改值与名称/备注）。 */
  async updateConfig(id: number, input: UpdateConfigDto): Promise<SysConfigBrief> {
    const existing = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('参数不存在');
    }
    // 变更留痕：系统参数直接影响运行行为，改动前值必须留档
    recordBefore({
      configKey: existing.configKey,
      configName: existing.configName,
      configValue: existing.configValue,
      remark: existing.remark,
    });
    const row = await this.prisma.sysConfig.update({
      where: { id: BigInt(id) },
      data: {
        configName: input.configName,
        configValue: input.configValue ?? '',
        remark: input.remark || null,
      },
    });
    recordAfter({
      configKey: row.configKey,
      configName: row.configName,
      configValue: row.configValue,
      remark: row.remark,
    });
    this.invalidate(row.configKey);
    return this.toSysConfigBrief(row);
  }

  /** 删除参数（内置参数不可删除）。 */
  async deleteConfig(id: number): Promise<void> {
    const existing = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('参数不存在');
    }
    if (Number(existing.systemFlag) === 1) {
      throw AppException.conflict('内置参数不可删除');
    }
    await this.prisma.sysConfig.delete({ where: { id: BigInt(id) } });
    this.invalidate(existing.configKey);
  }
}
