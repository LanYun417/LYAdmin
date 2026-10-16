/**
 * 系统参数服务。
 * 模块职责：参数分页查询、CRUD、按键取值（唯一操作 SysConfig 的层）。
 *
 * 关键约定（与原 Express 版 1:1）：
 * - `configKey` 即业务引用键，创建后不可修改（编辑 DTO 不含该字段）；
 * - `systemFlag=1` 的内置参数禁止删除（防止误删导致依赖方退化为默认行为），但值可改；
 * - 参数不参与鉴权缓存，变更无需清理鉴权缓存（与角色/菜单不同）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app.exception.js';
import { buildPageResult, parsePagination, readString } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
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

@Injectable()
export class ConfigService {
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
   * @param configKey 参数键名
   * @returns 键值对；键不存在时返回 null
   */
  async getConfigData(configKey: string): Promise<ConfigData | null> {
    const row = await this.prisma.sysConfig.findUnique({ where: { configKey } });
    if (!row) {
      return null;
    }
    return { configKey: row.configKey, configValue: row.configValue };
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
    return this.toSysConfigBrief(row);
  }

  /** 编辑参数（键名不可改，内置参数仅可改值与名称/备注）。 */
  async updateConfig(id: number, input: UpdateConfigDto): Promise<SysConfigBrief> {
    const existing = await this.prisma.sysConfig.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('参数不存在');
    }
    const row = await this.prisma.sysConfig.update({
      where: { id: BigInt(id) },
      data: {
        configName: input.configName,
        configValue: input.configValue ?? '',
        remark: input.remark || null,
      },
    });
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
  }
}
