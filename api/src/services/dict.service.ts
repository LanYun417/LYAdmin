/**
 * 字典服务。
 * 模块职责：字典类型 / 字典项的分页查询、CRUD、启停用，以及业务侧「按类型取启用项」。
 * 本模块是**唯一操作 DictType / DictItem 的层**。
 *
 * 关键约定：
 * - 字典项以 `dictType` 编码关联类型；类型编码一经创建不可修改（见 validators）。
 * - 字典值的唯一性在「同一类型内」由本层保证（数据库不强制），故新增/编辑均需判重。
 * - 删除类型须连带删除其下字典项，使用事务保证一致性。
 * - 字典不参与鉴权，故变更时**无需**清理鉴权缓存（与角色/菜单不同）。
 */
import { Op, type Transaction, type WhereOptions } from 'sequelize';
import { sequelize } from '@/config/database';
import { Status } from '@/constants';
import { DictItem, DictType } from '@/models';
import type { PageResult } from '@/types';
import { buildPageResult, parsePagination } from '@/utils/pagination';
import { AppError } from '@/utils/response';
import type {
  CreateDictItemInput,
  CreateDictTypeInput,
  UpdateDictItemInput,
  UpdateDictTypeInput,
} from '@/validators/dict.validator';

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

/** 将 DictType 实例转换为对外 DTO。 */
function toDictTypeBrief(type: DictType): DictTypeBrief {
  return {
    id: Number(type.id),
    dictName: type.dictName,
    dictType: type.dictType,
    status: Number(type.status),
    remark: type.remark,
    createdAt: type.get('createdAt') as Date,
    updatedAt: type.get('updatedAt') as Date,
  };
}

/** 将 DictItem 实例转换为对外 DTO。 */
function toDictItemBrief(item: DictItem): DictItemBrief {
  return {
    id: Number(item.id),
    dictType: item.dictType,
    dictLabel: item.dictLabel,
    dictValue: item.dictValue,
    sort: Number(item.sort),
    status: Number(item.status),
    remark: item.remark,
    createdAt: item.get('createdAt') as Date,
    updatedAt: item.get('updatedAt') as Date,
  };
}

/** 取字典类型，不存在则抛 404。 */
async function mustGetDictType(id: number): Promise<DictType> {
  const type = await DictType.findByPk(id);
  if (!type) {
    throw AppError.notFound('字典类型不存在');
  }
  return type;
}

/** 断言字典类型编码存在，否则抛 404（供新增字典项时校验所属类型）。 */
async function assertDictTypeExists(dictType: string, transaction?: Transaction): Promise<void> {
  const exists = await DictType.count({ where: { dictType }, transaction });
  if (exists === 0) {
    throw AppError.notFound('所属字典类型不存在');
  }
}

/**
 * 分页查询字典类型。
 * @param query 查询参数（page/pageSize/dictName/dictType/status）
 */
export async function listDictTypes(query: Record<string, unknown>): Promise<PageResult<DictTypeBrief>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const dictName = typeof query.dictName === 'string' ? query.dictName.trim() : '';
  if (dictName) {
    where.dictName = { [Op.like]: `%${dictName}%` };
  }
  const dictType = typeof query.dictType === 'string' ? query.dictType.trim() : '';
  if (dictType) {
    where.dictType = { [Op.like]: `%${dictType}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const { rows, count } = await DictType.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset,
    limit,
  });

  return buildPageResult(rows.map(toDictTypeBrief), count, page, pageSize);
}

/**
 * 新增字典类型（类型编码唯一）。
 * @param input 新增参数
 */
export async function createDictType(input: CreateDictTypeInput): Promise<DictTypeBrief> {
  const exists = await DictType.findOne({ where: { dictType: input.dictType } });
  if (exists) {
    throw AppError.conflict('字典类型编码已存在');
  }
  const type = await DictType.create({
    dictName: input.dictName,
    dictType: input.dictType,
    status: input.status,
    remark: input.remark || null,
  });
  return toDictTypeBrief(type);
}

/**
 * 编辑字典类型（类型编码不可修改）。
 * @param id 类型 id
 * @param input 编辑参数
 */
export async function updateDictType(id: number, input: UpdateDictTypeInput): Promise<DictTypeBrief> {
  const type = await mustGetDictType(id);
  await type.update({
    dictName: input.dictName,
    status: input.status,
    remark: input.remark || null,
  });
  return toDictTypeBrief(type);
}

/**
 * 启用 / 禁用字典类型。
 * @param id 类型 id
 * @param status 目标状态（1 启用 / 0 禁用）
 */
export async function setDictTypeStatus(id: number, status: number): Promise<DictTypeBrief> {
  const type = await mustGetDictType(id);
  await type.update({ status });
  return toDictTypeBrief(type);
}

/**
 * 删除字典类型（连带删除其下全部字典项，事务保证一致性）。
 * @param id 类型 id
 */
export async function deleteDictType(id: number): Promise<void> {
  const type = await mustGetDictType(id);
  await sequelize.transaction(async (transaction) => {
    await DictItem.destroy({ where: { dictType: type.dictType }, transaction });
    await type.destroy({ transaction });
  });
}

/**
 * 分页查询某类型下的字典项。
 * @param query 查询参数（dictType 必填；page/pageSize/dictLabel/status）
 */
export async function listDictItems(query: Record<string, unknown>): Promise<PageResult<DictItemBrief>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const dictType = String(query.dictType ?? '').trim();
  const where: WhereOptions = { dictType };

  const dictLabel = typeof query.dictLabel === 'string' ? query.dictLabel.trim() : '';
  if (dictLabel) {
    where.dictLabel = { [Op.like]: `%${dictLabel}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const { rows, count } = await DictItem.findAndCountAll({
    where,
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
    offset,
    limit,
  });

  return buildPageResult(rows.map(toDictItemBrief), count, page, pageSize);
}

/** 断言同一字典类型下字典值唯一（排除指定 id，用于编辑场景）。 */
async function assertDictValueUnique(dictType: string, dictValue: string, excludeId?: number): Promise<void> {
  const where: WhereOptions = { dictType, dictValue };
  if (excludeId !== undefined) {
    where.id = { [Op.ne]: excludeId };
  }
  const exists = await DictItem.count({ where });
  if (exists > 0) {
    throw AppError.conflict(`字典值「${dictValue}」在该类型下已存在`);
  }
}

/**
 * 新增字典项（校验所属类型存在、同类型下字典值唯一）。
 * @param input 新增参数
 */
export async function createDictItem(input: CreateDictItemInput): Promise<DictItemBrief> {
  await assertDictTypeExists(input.dictType);
  await assertDictValueUnique(input.dictType, input.dictValue);
  const item = await DictItem.create({
    dictType: input.dictType,
    dictLabel: input.dictLabel,
    dictValue: input.dictValue,
    sort: input.sort,
    status: input.status,
    remark: input.remark || null,
  });
  return toDictItemBrief(item);
}

/**
 * 编辑字典项（所属类型不可修改）。
 * @param id 字典项 id
 * @param input 编辑参数
 */
export async function updateDictItem(id: number, input: UpdateDictItemInput): Promise<DictItemBrief> {
  const item = await DictItem.findByPk(id);
  if (!item) {
    throw AppError.notFound('字典项不存在');
  }
  await assertDictValueUnique(item.dictType, input.dictValue, id);
  await item.update({
    dictLabel: input.dictLabel,
    dictValue: input.dictValue,
    sort: input.sort,
    status: input.status,
    remark: input.remark || null,
  });
  return toDictItemBrief(item);
}

/**
 * 启用 / 禁用字典项。
 * @param id 字典项 id
 * @param status 目标状态（1 启用 / 0 禁用）
 */
export async function setDictItemStatus(id: number, status: number): Promise<DictItemBrief> {
  const item = await DictItem.findByPk(id);
  if (!item) {
    throw AppError.notFound('字典项不存在');
  }
  await item.update({ status });
  return toDictItemBrief(item);
}

/**
 * 删除字典项。
 * @param id 字典项 id
 */
export async function deleteDictItem(id: number): Promise<void> {
  const item = await DictItem.findByPk(id);
  if (!item) {
    throw AppError.notFound('字典项不存在');
  }
  await item.destroy();
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
export async function getDictData(dictType: string): Promise<DictDataItem[]> {
  const type = await DictType.findOne({ where: { dictType }, attributes: ['id', 'status'] });
  if (!type || Number(type.status) !== Status.ENABLED) {
    return [];
  }
  const items = await DictItem.findAll({
    where: { dictType, status: Status.ENABLED },
    attributes: ['dictLabel', 'dictValue'],
    order: [
      ['sort', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return items.map((item) => ({ label: item.dictLabel, value: item.dictValue }));
}
