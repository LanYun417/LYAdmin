/**
 * 字典服务。
 * 模块职责：字典类型 / 字典项的分页查询、CRUD、启停用，以及业务侧「按类型取启用项」。
 * 本模块是**唯一操作 DictType / DictItem 的层**。
 *
 * 关键约定：
 * - 字典项以 `dictType` 编码字符串关联类型；类型编码一经创建不可修改（见 DTO）。
 * - 字典值的唯一性在「同一类型内」由本层保证（数据库不强制），故新增/编辑均需判重。
 * - 删除类型须连带删除其下字典项，使用事务保证一致性（Prisma 已配 onDelete: Cascade）。
 * - 字典不参与鉴权，故变更时**无需**清理鉴权缓存（与角色/菜单不同）。
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { Status } from '../../common/config/constants.js';
import { buildPageResult, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PageResult } from '../../common/types.js';
import type { CreateDictItemDto, CreateDictTypeDto, UpdateDictItemDto, UpdateDictTypeDto } from './dto/dict.dto.js';

/**
 * 内置字典类型：项目自身界面依赖它们（如「通用状态」驱动各页面的启用/禁用选项），
 * 因此禁止**删除**与**禁用**，避免管理端误操作导致状态列回退成原始值 1 / 0。
 * 与 `user.service.ts` 的 BUILTIN_ADMIN 同一思路：内置资源用常量白名单保护。
 */
const BUILTIN_DICT_TYPES = ['sys_user_sex', 'sys_yes_no', 'sys_common_status'];

/** 字典类型（对外 DTO）。 */
export interface DictTypeBrief {
  id: number;
  dictName: string;
  dictType: string;
  status: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 字典项（对外 DTO）。 */
export interface DictItemBrief {
  id: number;
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sort: number;
  status: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 业务侧字典数据项（精简，供下拉/标签渲染）。 */
export interface DictDataItem {
  label: string;
  value: string;
}

@Injectable()
export class DictService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prisma 字典类型记录 → DictTypeBrief DTO。 */
  private toDictTypeBrief(row: {
    id: bigint;
    dictName: string;
    dictType: string;
    status: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DictTypeBrief {
    return {
      id: Number(row.id),
      dictName: row.dictName,
      dictType: row.dictType,
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Prisma 字典项记录 → DictItemBrief DTO。 */
  private toDictItemBrief(row: {
    id: bigint;
    dictType: string;
    dictLabel: string;
    dictValue: string;
    sort: number;
    status: number;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DictItemBrief {
    return {
      id: Number(row.id),
      dictType: row.dictType,
      dictLabel: row.dictLabel,
      dictValue: row.dictValue,
      sort: Number(row.sort),
      status: Number(row.status),
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * 分页查询字典类型。
   * @param query 查询参数（page/pageSize/dictName/dictType/status）
   */
  async listDictTypes(query: Record<string, unknown>): Promise<PageResult<DictTypeBrief>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const dictName = readString(query.dictName);
    const dictType = readString(query.dictType);
    const status = readNumber(query.status);

    const rows = await this.prisma.dictType.findMany({
      where: {
        ...(dictName ? { dictName: { contains: dictName } } : {}),
        ...(dictType ? { dictType: { contains: dictType } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: limit,
    });
    const count = await this.prisma.dictType.count({
      where: {
        ...(dictName ? { dictName: { contains: dictName } } : {}),
        ...(dictType ? { dictType: { contains: dictType } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    return buildPageResult(
      rows.map((row) => this.toDictTypeBrief(row)),
      count,
      page,
      pageSize,
    );
  }

  /**
   * 新增字典类型（类型编码唯一）。
   * @param input 新增参数
   */
  async createDictType(input: CreateDictTypeDto): Promise<DictTypeBrief> {
    const exists = await this.prisma.dictType.findUnique({ where: { dictType: input.dictType } });
    if (exists) {
      throw AppException.conflict('字典类型编码已存在');
    }
    const row = await this.prisma.dictType.create({
      data: {
        dictName: input.dictName,
        dictType: input.dictType,
        status: input.status ?? 1,
        remark: input.remark || null,
      },
    });
    return this.toDictTypeBrief(row);
  }

  /**
   * 编辑字典类型（类型编码不可修改）。
   * @param id 类型 id
   * @param input 编辑参数
   */
  async updateDictType(id: number, input: UpdateDictTypeDto): Promise<DictTypeBrief> {
    const existing = await this.prisma.dictType.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典类型不存在');
    }
    const row = await this.prisma.dictType.update({
      where: { id: BigInt(id) },
      data: {
        dictName: input.dictName,
        status: input.status ?? 1,
        remark: input.remark || null,
      },
    });
    return this.toDictTypeBrief(row);
  }

  /**
   * 启用 / 禁用字典类型。
   * @param id 类型 id
   * @param status 目标状态（1 启用 / 0 禁用）
   */
  async setDictTypeStatus(id: number, status: number): Promise<DictTypeBrief> {
    const existing = await this.prisma.dictType.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典类型不存在');
    }
    if (status !== Status.ENABLED && BUILTIN_DICT_TYPES.includes(existing.dictType)) {
      throw AppException.conflict('内置字典类型不可禁用');
    }
    const row = await this.prisma.dictType.update({ where: { id: BigInt(id) }, data: { status } });
    return this.toDictTypeBrief(row);
  }

  /**
   * 删除字典类型（连带删除其下全部字典项，事务保证一致性）。
   * @param id 类型 id
   */
  async deleteDictType(id: number): Promise<void> {
    const existing = await this.prisma.dictType.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典类型不存在');
    }
    if (BUILTIN_DICT_TYPES.includes(existing.dictType)) {
      throw AppException.conflict('内置字典类型不可删除');
    }
    await this.prisma.$transaction([
      this.prisma.dictItem.deleteMany({ where: { dictType: existing.dictType } }),
      this.prisma.dictType.delete({ where: { id: BigInt(id) } }),
    ]);
  }

  /**
   * 分页查询某类型下的字典项。
   * @param query 查询参数（dictType 必填；page/pageSize/dictLabel/status）
   */
  async listDictItems(query: Record<string, unknown>): Promise<PageResult<DictItemBrief>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const dictType = readString(query.dictType) ?? '';
    const dictLabel = readString(query.dictLabel);
    const status = readNumber(query.status);

    const rows = await this.prisma.dictItem.findMany({
      where: {
        dictType,
        ...(dictLabel ? { dictLabel: { contains: dictLabel } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit,
    });
    const count = await this.prisma.dictItem.count({
      where: {
        dictType,
        ...(dictLabel ? { dictLabel: { contains: dictLabel } } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    return buildPageResult(
      rows.map((row) => this.toDictItemBrief(row)),
      count,
      page,
      pageSize,
    );
  }

  /**
   * 新增字典项（校验所属类型存在、同类型下字典值唯一）。
   * @param input 新增参数
   */
  async createDictItem(input: CreateDictItemDto): Promise<DictItemBrief> {
    const typeExists = await this.prisma.dictType.count({ where: { dictType: input.dictType } });
    if (typeExists === 0) {
      throw AppException.notFound('所属字典类型不存在');
    }
    const dup = await this.prisma.dictItem.count({
      where: { dictType: input.dictType, dictValue: input.dictValue },
    });
    if (dup > 0) {
      throw AppException.conflict(`字典值「${input.dictValue}」在该类型下已存在`);
    }
    const row = await this.prisma.dictItem.create({
      data: {
        dictType: input.dictType,
        dictLabel: input.dictLabel,
        dictValue: input.dictValue,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        remark: input.remark || null,
      },
    });
    return this.toDictItemBrief(row);
  }

  /**
   * 编辑字典项（所属类型不可修改）。
   * @param id 字典项 id
   * @param input 编辑参数
   */
  async updateDictItem(id: number, input: UpdateDictItemDto): Promise<DictItemBrief> {
    const existing = await this.prisma.dictItem.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典项不存在');
    }
    const dup = await this.prisma.dictItem.count({
      where: { dictType: existing.dictType, dictValue: input.dictValue, NOT: { id: BigInt(id) } },
    });
    if (dup > 0) {
      throw AppException.conflict(`字典值「${input.dictValue}」在该类型下已存在`);
    }
    const row = await this.prisma.dictItem.update({
      where: { id: BigInt(id) },
      data: {
        dictLabel: input.dictLabel,
        dictValue: input.dictValue,
        sort: input.sort ?? 0,
        status: input.status ?? 1,
        remark: input.remark || null,
      },
    });
    return this.toDictItemBrief(row);
  }

  /**
   * 启用 / 禁用字典项。
   * @param id 字典项 id
   * @param status 目标状态（1 启用 / 0 禁用）
   */
  async setDictItemStatus(id: number, status: number): Promise<DictItemBrief> {
    const existing = await this.prisma.dictItem.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典项不存在');
    }
    const row = await this.prisma.dictItem.update({ where: { id: BigInt(id) }, data: { status } });
    return this.toDictItemBrief(row);
  }

  /**
   * 删除字典项。
   * @param id 字典项 id
   */
  async deleteDictItem(id: number): Promise<void> {
    const existing = await this.prisma.dictItem.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
      throw AppException.notFound('字典项不存在');
    }
    await this.prisma.dictItem.delete({ where: { id: BigInt(id) } });
  }

  /**
   * 业务侧取字典数据：按类型编码返回**启用中**的字典项（标签 + 值）。
   *
   * 仅供已登录用户调用（不设权限码，见 routes/dict.routes.ts 的说明）：
   * 字典属 UI 元数据，任意业务页面都可能用它渲染下拉/标签。
   * 若类型本身被禁用，则视为不可用，返回空数组（不抛错，避免前端页面渲染失败）。
   *
   * @param dictType 字典类型编码
   */
  async getDictData(dictType: string): Promise<DictDataItem[]> {
    const type = await this.prisma.dictType.findUnique({
      where: { dictType },
      select: { status: true },
    });
    if (!type || Number(type.status) !== Status.ENABLED) {
      return [];
    }
    const items = await this.prisma.dictItem.findMany({
      where: { dictType, status: Status.ENABLED },
      select: { dictLabel: true, dictValue: true },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return items.map((item) => ({ label: item.dictLabel, value: item.dictValue }));
  }
}
