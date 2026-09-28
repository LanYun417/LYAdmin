/**
 * 系统参数服务。
 * 模块职责：参数分页查询、CRUD、按键取值（唯一操作 SysConfig 的层）。
 *
 * 关键约定：
 * - `configKey` 即业务引用键，创建后不可修改（编辑 schema 不含该字段）；
 * - `systemFlag=1` 的内置参数禁止删除（防止误删导致依赖方退化为默认行为），但值可改；
 * - 参数不参与鉴权缓存，变更无需清理鉴权缓存（与角色/菜单不同）。
 */
import { Op, type WhereOptions } from 'sequelize';
import { SysConfig } from '@/models';
import type { PageResult } from '@/types';
import { buildPageResult, parsePagination } from '@/utils/pagination';
import { AppError } from '@/utils/response';
import type { CreateConfigInput, UpdateConfigInput } from '@/validators/config.validator';

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

/** 将 SysConfig 实例转换为对外 DTO。 */
function toSysConfigBrief(config: SysConfig): SysConfigBrief {
  return {
    id: Number(config.id),
    configName: config.configName,
    configKey: config.configKey,
    configValue: config.configValue,
    systemFlag: Number(config.systemFlag),
    remark: config.remark,
    createdAt: config.get('createdAt') as Date,
    updatedAt: config.get('updatedAt') as Date,
  };
}

/**
 * 分页查询参数。
 * @param query 查询参数（page/pageSize/configName/configKey）
 */
export async function listConfigs(query: Record<string, unknown>): Promise<PageResult<SysConfigBrief>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const configName = typeof query.configName === 'string' ? query.configName.trim() : '';
  if (configName) {
    where.configName = { [Op.like]: `%${configName}%` };
  }
  const configKey = typeof query.configKey === 'string' ? query.configKey.trim() : '';
  if (configKey) {
    where.configKey = { [Op.like]: `%${configKey}%` };
  }

  const { rows, count } = await SysConfig.findAndCountAll({
    where,
    order: [['id', 'ASC']],
    offset,
    limit,
  });

  return buildPageResult(rows.map(toSysConfigBrief), count, page, pageSize);
}

/** 参数详情。 */
export async function getConfigDetail(id: number): Promise<SysConfigBrief> {
  const config = await SysConfig.findByPk(id);
  if (!config) {
    throw AppError.notFound('参数不存在');
  }
  return toSysConfigBrief(config);
}

/**
 * 按键取参数值（业务取数，仅需登录）。
 * @param configKey 参数键名
 * @returns 键值对；键不存在时返回 null
 */
export async function getConfigData(configKey: string): Promise<ConfigData | null> {
  const config = await SysConfig.findOne({ where: { configKey } });
  if (!config) {
    return null;
  }
  return { configKey: config.configKey, configValue: config.configValue };
}

/** 新增参数。 */
export async function createConfig(input: CreateConfigInput): Promise<SysConfigBrief> {
  const exists = await SysConfig.findOne({ where: { configKey: input.configKey } });
  if (exists) {
    throw AppError.conflict('参数键名已存在');
  }
  const config = await SysConfig.create({
    configName: input.configName,
    configKey: input.configKey,
    configValue: input.configValue ?? '',
    systemFlag: 0,
    remark: input.remark || null,
  });
  return toSysConfigBrief(config);
}

/** 编辑参数（键名不可改，内置参数仅可改值与名称/备注）。 */
export async function updateConfig(id: number, input: UpdateConfigInput): Promise<SysConfigBrief> {
  const config = await SysConfig.findByPk(id);
  if (!config) {
    throw AppError.notFound('参数不存在');
  }
  await config.update({
    configName: input.configName,
    configValue: input.configValue ?? '',
    remark: input.remark || null,
  });
  return toSysConfigBrief(config);
}

/** 删除参数（内置参数不可删除）。 */
export async function deleteConfig(id: number): Promise<void> {
  const config = await SysConfig.findByPk(id);
  if (!config) {
    throw AppError.notFound('参数不存在');
  }
  if (Number(config.systemFlag) === 1) {
    throw AppError.conflict('内置参数不可删除');
  }
  await config.destroy();
}
